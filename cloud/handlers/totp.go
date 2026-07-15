package handlers

import (
	"net/http"

	"ranpak-cloud/database"
	"ranpak-cloud/models"

	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
)

type TOTPEnableRequest struct {
	Code string `json:"code" binding:"required,len=6"`
}

type TOTPDisableRequest struct {
	Code string `json:"code" binding:"required,len=6"`
}

func TOTPSetup(c *gin.Context) {
	userID := c.MustGet("userId").(uint)

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
		return
	}

	if user.TOTPEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "两步验证已开启，请先关闭后重新设置"})
		return
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "RanTerminal",
		AccountName: user.Username,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "生成密钥失败"})
		return
	}

	user.TOTPSecret = key.Secret()
	database.DB.Save(&user)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data": gin.H{
			"secret": key.Secret(),
			"url":    key.URL(),
		},
	})
}

func TOTPEnable(c *gin.Context) {
	var req TOTPEnableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请输入 6 位验证码"})
		return
	}

	userID := c.MustGet("userId").(uint)

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
		return
	}

	if user.TOTPSecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请先调用 setup 生成密钥"})
		return
	}

	if !totp.Validate(req.Code, user.TOTPSecret) {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "验证码错误，请确认 Authenticator 已正确配置"})
		return
	}

	user.TOTPEnabled = true
	database.DB.Save(&user)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "两步验证已开启",
		"data":    user.ToResponse(),
	})
}

func TOTPDisable(c *gin.Context) {
	var req TOTPDisableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请输入当前 6 位验证码"})
		return
	}

	userID := c.MustGet("userId").(uint)

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "用户不存在"})
		return
	}

	if !user.TOTPEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "两步验证未开启"})
		return
	}

	if !totp.Validate(req.Code, user.TOTPSecret) {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "验证码错误"})
		return
	}

	user.TOTPEnabled = false
	user.TOTPSecret = ""
	database.DB.Save(&user)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "两步验证已关闭",
		"data":    user.ToResponse(),
	})
}
