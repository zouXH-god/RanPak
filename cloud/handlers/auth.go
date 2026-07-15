package handlers

import (
	"net/http"
	"time"

	"ranpak-cloud/database"
	"ranpak-cloud/middleware"
	"ranpak-cloud/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=32"`
	Password string `json:"password" binding:"required,min=6,max=64"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	TOTPCode string `json:"totpCode"`
}

type LoginResponse struct {
	Token string              `json:"token"`
	User  models.UserResponse `json:"user"`
}

func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error()})
		return
	}

	var settings models.ServerSettings
	database.DB.First(&settings, 1)

	var userCount int64
	database.DB.Model(&models.User{}).Count(&userCount)
	isFirstUser := userCount == 0

	if !isFirstUser && !settings.AllowRegistration {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "当前不允许注册新用户"})
		return
	}

	var existingUser models.User
	if err := database.DB.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"code": 409, "message": "用户名已存在"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "密码加密失败"})
		return
	}

	role := models.RoleUser
	status := models.StatusActive
	if isFirstUser {
		role = models.RoleAdmin
	} else if settings.RequireApproval {
		status = models.StatusPending
	}

	user := models.User{
		Username: req.Username,
		Password: string(hashedPassword),
		Role:     role,
		Status:   status,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建用户失败"})
		return
	}

	if status == models.StatusPending {
		c.JSON(http.StatusOK, gin.H{
			"code":    200,
			"message": "注册成功，等待管理员审核",
			"data": gin.H{
				"user":    user.ToResponse(),
				"pending": true,
			},
		})
		return
	}

	jwtSecret := c.MustGet("jwtSecret").(string)
	token, err := generateToken(user, jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "生成令牌失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "注册成功",
		"data": LoginResponse{
			Token: token,
			User:  user.ToResponse(),
		},
	})
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	var user models.User
	if err := database.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "用户名或密码错误"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "用户名或密码错误"})
		return
	}

	if user.Status == models.StatusPending {
		c.JSON(http.StatusOK, gin.H{"code": 4003, "message": "账号待审核，请联系管理员"})
		return
	}

	if user.TOTPEnabled {
		if req.TOTPCode == "" {
			c.JSON(http.StatusOK, gin.H{"code": 4001, "message": "需要两步验证码"})
			return
		}
		if !totp.Validate(req.TOTPCode, user.TOTPSecret) {
			c.JSON(http.StatusOK, gin.H{"code": 4002, "message": "验证码错误或已过期"})
			return
		}
	}

	jwtSecret := c.MustGet("jwtSecret").(string)
	token, err := generateToken(user, jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "生成令牌失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "登录成功",
		"data": LoginResponse{
			Token: token,
			User:  user.ToResponse(),
		},
	})
}

func generateToken(user models.User, secret string) (string, error) {
	claims := middleware.Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
