package handlers

import (
	"net/http"
	"time"

	"ranpak-cloud/database"
	"ranpak-cloud/models"
	"ranpak-cloud/services"

	"github.com/gin-gonic/gin"
)

var validDataTypes = map[string]bool{
	"ai_config":           true,
	"ssh_profiles":        true,
	"ssh_history":         true,
	"ssh_preset_commands": true,
	"dns_accounts":        true,
	"feature_visibility":  true,
}

func GetSyncStatus(c *gin.Context) {
	userID := c.MustGet("userId").(uint)

	var syncDataList []models.SyncData
	database.DB.Where("user_id = ?", userID).Find(&syncDataList)

	result := make(map[string]int64)
	for _, sd := range syncDataList {
		result[sd.DataType] = sd.UpdatedAt.UnixMilli()
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    result,
	})
}

func GetSyncData(c *gin.Context) {
	dataType := c.Param("type")
	if !validDataTypes[dataType] {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "不支持的数据类型"})
		return
	}

	userID := c.MustGet("userId").(uint)

	var syncData models.SyncData
	err := database.DB.Where("user_id = ? AND data_type = ?", userID, dataType).First(&syncData).Error
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"code":    200,
			"message": "success",
			"data": models.SyncResponse{
				Data:      "{}",
				Version:   0,
				UpdatedAt: 0,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data": models.SyncResponse{
			Data:      syncData.Content,
			Version:   syncData.Version,
			UpdatedAt: syncData.UpdatedAt.UnixMilli(),
		},
	})
}

func GetAllSyncData(c *gin.Context) {
	userID := c.MustGet("userId").(uint)

	var syncDataList []models.SyncData
	database.DB.Where("user_id = ?", userID).Find(&syncDataList)

	result := make(map[string]models.SyncResponse)
	for _, sd := range syncDataList {
		result[sd.DataType] = models.SyncResponse{
			Data:      sd.Content,
			Version:   sd.Version,
			UpdatedAt: sd.UpdatedAt.UnixMilli(),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data":    result,
	})
}

func MergeSyncData(c *gin.Context) {
	if rejectLegacyV2(c) {
		return
	}
	dataType := c.Param("type")
	if !validDataTypes[dataType] {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "不支持的数据类型"})
		return
	}

	var req models.SyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error()})
		return
	}

	userID := c.MustGet("userId").(uint)

	var existing models.SyncData
	err := database.DB.Where("user_id = ? AND data_type = ?", userID, dataType).First(&existing).Error

	if err != nil {
		// 首次同步，直接存储
		newData := models.SyncData{
			UserID:    userID,
			DataType:  dataType,
			Content:   req.Data,
			Version:   1,
			UpdatedAt: time.Now(),
		}
		database.DB.Create(&newData)

		c.JSON(http.StatusOK, gin.H{
			"code":    200,
			"message": "success",
			"data": models.SyncResponse{
				Data:        req.Data,
				Version:     1,
				UpdatedAt:   newData.UpdatedAt.UnixMilli(),
				HasConflict: false,
			},
		})
		return
	}

	// 版本一致，无冲突直接更新
	if req.Version == existing.Version {
		existing.Content = req.Data
		existing.Version++
		existing.UpdatedAt = time.Now()
		database.DB.Save(&existing)

		c.JSON(http.StatusOK, gin.H{
			"code":    200,
			"message": "success",
			"data": models.SyncResponse{
				Data:        existing.Content,
				Version:     existing.Version,
				UpdatedAt:   existing.UpdatedAt.UnixMilli(),
				HasConflict: false,
			},
		})
		return
	}

	// 版本不一致，执行双向合并
	merged, hasConflict := services.MergeData(dataType, existing.Content, req.Data)

	existing.Content = merged
	existing.Version++
	existing.UpdatedAt = time.Now()
	database.DB.Save(&existing)

	c.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "success",
		"data": models.SyncResponse{
			Data:        existing.Content,
			Version:     existing.Version,
			UpdatedAt:   existing.UpdatedAt.UnixMilli(),
			HasConflict: hasConflict,
		},
	})
}
