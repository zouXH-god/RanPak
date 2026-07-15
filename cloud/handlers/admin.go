package handlers

import (
	"net/http"

	"ranpak-cloud/database"
	"ranpak-cloud/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type CreateUserRequest struct {
	Username string          `json:"username" binding:"required,min=3,max=32"`
	Password string          `json:"password" binding:"required,min=6,max=64"`
	Role     models.UserRole `json:"role" binding:"required,oneof=admin user"`
}

type UpdateUserRequest struct {
	Password string          `json:"password" binding:"omitempty,min=6,max=64"`
	Role     models.UserRole `json:"role" binding:"omitempty,oneof=admin user"`
}

func ListUsers(c *gin.Context) {
	var users []models.User
	database.DB.Order("created_at DESC").Find(&users)

	var result []models.UserResponse
	for _, u := range users {
		result = append(result, u.ToResponse())
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    result,
	})
}

func CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error()})
		return
	}

	var existing models.User
	if err := database.DB.Where("username = ?", req.Username).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"code": 409, "message": "用户名已存在"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "密码加密失败"})
		return
	}

	user := models.User{
		Username: req.Username,
		Password: string(hashedPassword),
		Role:     req.Role,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建用户失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "创建成功",
		"data":    user.ToResponse(),
	})
}

func UpdateUser(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error()})
		return
	}

	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "密码加密失败"})
			return
		}
		user.Password = string(hashedPassword)
	}

	if req.Role != "" {
		user.Role = req.Role
	}

	database.DB.Save(&user)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "更新成功",
		"data":    user.ToResponse(),
	})
}

func GetServerSettings(c *gin.Context) {
	var settings models.ServerSettings
	database.DB.First(&settings, 1)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    settings,
	})
}

type UpdateServerSettingsRequest struct {
	AllowRegistration *bool `json:"allowRegistration"`
	RequireApproval   *bool `json:"requireApproval"`
}

func UpdateServerSettings(c *gin.Context) {
	var req UpdateServerSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	var settings models.ServerSettings
	database.DB.First(&settings, 1)

	if req.AllowRegistration != nil {
		settings.AllowRegistration = *req.AllowRegistration
	}
	if req.RequireApproval != nil {
		settings.RequireApproval = *req.RequireApproval
	}

	database.DB.Save(&settings)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "设置已更新",
		"data":    settings,
	})
}

func ApproveUser(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
		return
	}

	if user.Status != models.StatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "该用户不需要审核"})
		return
	}

	user.Status = models.StatusActive
	database.DB.Save(&user)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "用户已通过审核",
		"data":    user.ToResponse(),
	})
}

func DeleteUser(c *gin.Context) {
	id := c.Param("id")
	currentUserID := c.MustGet("userId").(uint)

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
		return
	}

	if user.ID == currentUserID {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "不能删除自己"})
		return
	}

	// 同时删除用户的同步数据
	database.DB.Where("user_id = ?", user.ID).Delete(&models.SyncData{})
	database.DB.Delete(&user)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "删除成功",
	})
}
