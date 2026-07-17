package handlers

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"net/http"
	"ranpak-cloud/database"
	"ranpak-cloud/models"
	"strconv"
	"time"
)

func deviceTokenHash(token string) string { return fmt.Sprintf("%x", sha256.Sum256([]byte(token))) }

func requireSyncV2Device(c *gin.Context, deviceID string) (*models.SyncDevice, bool) {
	if deviceID == "" {
		deviceID = c.GetHeader("X-RanPak-Device-ID")
	}
	token := c.GetHeader("X-RanPak-Device-Token")
	if deviceID == "" || token == "" {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "缺少设备凭证"})
		return nil, false
	}
	var device models.SyncDevice
	userID := c.MustGet("userId").(uint)
	if database.DB.Where("user_id=? AND device_id=? AND revoked_at IS NULL", userID, deviceID).First(&device).Error != nil || device.TokenHash == "" || subtle.ConstantTimeCompare([]byte(device.TokenHash), []byte(deviceTokenHash(token))) != 1 {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "设备未注册、已撤销或凭证无效"})
		return nil, false
	}
	return &device, true
}

func RegisterSyncV2Device(c *gin.Context) {
	userID := c.MustGet("userId").(uint)
	var req struct {
		DeviceID    string `json:"deviceId" binding:"required,max=64"`
		Name        string `json:"name" binding:"max=128"`
		KeyID       string `json:"keyId" binding:"required,max=64"`
		DeviceToken string `json:"deviceToken" binding:"required,min=32,max=128"`
	}
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(400, gin.H{"code": 400, "message": "参数错误"})
		return
	}
	now := time.Now()
	var existing models.SyncDevice
	findErr := database.DB.Where("user_id=? AND device_id=?", userID, req.DeviceID).First(&existing).Error
	if findErr == nil && existing.RevokedAt != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "设备已撤销，不能重新注册"})
		return
	}
	if findErr == nil && existing.TokenHash != "" && subtle.ConstantTimeCompare([]byte(existing.TokenHash), []byte(deviceTokenHash(req.DeviceToken))) != 1 {
		c.JSON(403, gin.H{"code": 403, "message": "设备凭证无效"})
		return
	}
	var device models.SyncDevice
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var state models.SyncAccountState
		stateErr := tx.First(&state, "user_id = ?", userID).Error
		if stateErr == gorm.ErrRecordNotFound {
			state = models.SyncAccountState{UserID: userID, ProtocolVersion: 1, PendingKeyID: req.KeyID}
			if e := tx.Create(&state).Error; e != nil {
				return e
			}
		} else if stateErr != nil {
			return stateErr
		} else if state.ProtocolVersion >= 2 && state.KeyID != "" && state.KeyID != req.KeyID {
			return fmt.Errorf("key mismatch")
		} else {
			if state.ProtocolVersion < 2 && state.PendingKeyID != "" && state.PendingKeyID != req.KeyID {
				return fmt.Errorf("key mismatch")
			}
			state.PendingKeyID = req.KeyID
			if e := tx.Save(&state).Error; e != nil {
				return e
			}
		}
		device = models.SyncDevice{UserID: userID, DeviceID: req.DeviceID, Name: req.Name, KeyID: req.KeyID, TokenHash: deviceTokenHash(req.DeviceToken), LastSeenAt: now}
		if findErr == nil {
			existing.Name, existing.KeyID, existing.TokenHash, existing.LastSeenAt = req.Name, req.KeyID, device.TokenHash, now
			if e := tx.Save(&existing).Error; e != nil {
				return e
			}
			device = existing
			return nil
		}
		return tx.Create(&device).Error
	})
	if err != nil {
		if err.Error() == "key mismatch" {
			c.JSON(409, gin.H{"code": 409, "message": "恢复密钥与同步空间不匹配"})
		} else {
			c.JSON(500, gin.H{"code": 500, "message": "设备注册失败"})
		}
		return
	}
	c.JSON(200, gin.H{"code": 200, "data": device})
}
func ListSyncV2Devices(c *gin.Context) {
	if _, ok := requireSyncV2Device(c, ""); !ok {
		return
	}
	var rows []models.SyncDevice
	database.DB.Where("user_id=?", c.MustGet("userId")).Order("created_at").Find(&rows)
	c.JSON(200, gin.H{"code": 200, "data": rows})
}
func RevokeSyncV2Device(c *gin.Context) {
	if _, ok := requireSyncV2Device(c, ""); !ok {
		return
	}
	userID := c.MustGet("userId").(uint)
	now := time.Now()
	r := database.DB.Model(&models.SyncDevice{}).Where("user_id=? AND device_id=?", userID, c.Param("id")).Update("revoked_at", now)
	if r.RowsAffected == 0 {
		c.JSON(404, gin.H{"code": 404, "message": "设备不存在"})
		return
	}
	c.JSON(200, gin.H{"code": 200, "data": true})
}
func PushSyncV2(c *gin.Context) {
	userID := c.MustGet("userId").(uint)
	var req struct {
		DeviceID   string                        `json:"deviceId" binding:"required"`
		Operations []models.SyncV2OperationInput `json:"operations" binding:"required,max=500"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"code": 400, "message": "参数错误: " + err.Error()})
		return
	}
	device, ok := requireSyncV2Device(c, req.DeviceID)
	if !ok {
		return
	}
	var accountState models.SyncAccountState
	if database.DB.First(&accountState, "user_id=?", userID).Error != nil || (accountState.ProtocolVersion >= 2 && accountState.KeyID != device.KeyID) || (accountState.ProtocolVersion < 2 && accountState.PendingKeyID != device.KeyID) {
		c.JSON(http.StatusConflict, gin.H{"code": 409, "message": "设备恢复密钥与同步空间不匹配"})
		return
	}
	allowedTypes := map[string]bool{"app_config": true, "ssh_profile": true, "ssh_folder": true, "ssh_private_key": true, "ssh_import_source": true, "ssh_preset_command": true, "dns_account": true, "ssh_history": true, "local_storage": true}
	for _, op := range req.Operations {
		if !allowedTypes[op.EntityType] || (op.DeviceID != "" && op.DeviceID != req.DeviceID) || len(op.MergeParents) > 32 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "同步操作字段无效"})
			return
		}
		algorithm, _ := op.Envelope["algorithm"].(string)
		keyID, _ := op.Envelope["keyId"].(string)
		if algorithm != "AES-256-GCM" || keyID != device.KeyID || op.Envelope["nonce"] == nil || op.Envelope["ciphertext"] == nil || op.Envelope["tag"] == nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "加密信封无效"})
			return
		}
	}
	accepted := map[string]uint64{}
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		for _, op := range req.Operations {
			var old models.SyncOperation
			if tx.Where("op_id=? AND user_id=?", op.OpID, userID).First(&old).Error == nil {
				accepted[op.OpID] = old.Seq
				continue
			}
			env, _ := json.Marshal(op.Envelope)
			parents, _ := json.Marshal(op.MergeParents)
			row := models.SyncOperation{UserID: userID, OpID: op.OpID, DeviceID: req.DeviceID, EntityType: op.EntityType, EntityID: op.EntityID, ParentOpID: op.ParentOpID, MergeParents: string(parents), ContentHash: op.ContentHash, Deleted: op.Deleted, Envelope: string(env)}
			if e := tx.Create(&row).Error; e != nil {
				return e
			}
			accepted[op.OpID] = row.Seq
		}
		return tx.Model(device).Update("last_seen_at", time.Now()).Error
	})
	if err != nil {
		c.JSON(500, gin.H{"code": 500, "message": "提交失败"})
		return
	}
	c.JSON(200, gin.H{"code": 200, "data": gin.H{"accepted": accepted}})
}
func PullSyncV2(c *gin.Context) {
	if _, ok := requireSyncV2Device(c, ""); !ok {
		return
	}
	userID := c.MustGet("userId").(uint)
	cursor, _ := strconv.ParseUint(c.DefaultQuery("cursor", "0"), 10, 64)
	var rows []models.SyncOperation
	database.DB.Where("user_id=? AND seq>?", userID, cursor).Order("seq").Limit(500).Find(&rows)
	out := make([]gin.H, 0, len(rows))
	next := cursor
	for _, r := range rows {
		var env interface{}
		json.Unmarshal([]byte(r.Envelope), &env)
		var parents interface{}
		json.Unmarshal([]byte(r.MergeParents), &parents)
		out = append(out, gin.H{"seq": r.Seq, "opId": r.OpID, "deviceId": r.DeviceID, "entityType": r.EntityType, "entityId": r.EntityID, "parentOpId": r.ParentOpID, "mergeParents": parents, "contentHash": r.ContentHash, "deleted": r.Deleted, "envelope": env, "createdAt": r.CreatedAt})
		next = r.Seq
	}
	c.JSON(200, gin.H{"code": 200, "data": gin.H{"operations": out, "cursor": next, "hasMore": len(rows) == 500}})
}
func SyncV2Status(c *gin.Context) {
	if _, ok := requireSyncV2Device(c, ""); !ok {
		return
	}
	userID := c.MustGet("userId").(uint)
	var state models.SyncAccountState
	database.DB.First(&state, "user_id=?", userID)
	var maxSeq uint64
	database.DB.Model(&models.SyncOperation{}).Where("user_id=?", userID).Select("COALESCE(MAX(seq),0)").Scan(&maxSeq)
	type overviewRow struct {
		Category  string
		Count     int64
		UpdatedAt int64
	}
	var rows []overviewRow
	if err := database.DB.Raw(`
		SELECT CASE
			WHEN current.entity_type='app_config' AND current.entity_id='ai' THEN 'ai_config'
			WHEN current.entity_type='ssh_profile' THEN 'ssh_profiles'
			WHEN current.entity_type='ssh_history' THEN 'ssh_history'
			WHEN current.entity_type='dns_account' THEN 'dns_accounts'
		END AS category, COUNT(*) AS count,
		CAST((julianday(MAX(current.created_at)) - 2440587.5) * 86400000 AS INTEGER) AS updated_at
		FROM sync_operations current
		JOIN (
			SELECT entity_type, entity_id, MAX(seq) AS seq
			FROM sync_operations WHERE user_id=? GROUP BY entity_type, entity_id
		) latest ON latest.seq=current.seq
		WHERE current.user_id=? AND current.deleted=0 AND (
			(current.entity_type='app_config' AND current.entity_id='ai') OR
			current.entity_type IN ('ssh_profile','ssh_history','dns_account')
		) GROUP BY category`, userID, userID).Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "同步数据统计失败"})
		return
	}
	overview := map[string]gin.H{
		"ai_config": {"count": int64(0), "updatedAt": int64(0)}, "ssh_profiles": {"count": int64(0), "updatedAt": int64(0)},
		"ssh_history": {"count": int64(0), "updatedAt": int64(0)}, "dns_accounts": {"count": int64(0), "updatedAt": int64(0)},
	}
	for _, row := range rows {
		overview[row.Category] = gin.H{"count": row.Count, "updatedAt": row.UpdatedAt}
	}
	var operationCount, deviceCount int64
	database.DB.Model(&models.SyncOperation{}).Where("user_id=?", userID).Count(&operationCount)
	database.DB.Model(&models.SyncDevice{}).Where("user_id=? AND revoked_at IS NULL", userID).Count(&deviceCount)
	c.JSON(200, gin.H{"code": 200, "data": gin.H{"protocolVersion": state.ProtocolVersion, "keyId": state.KeyID, "latestCursor": maxSeq, "overview": overview, "operationCount": operationCount, "deviceCount": deviceCount}})
}
func ResetSyncV2(c *gin.Context) {
	if _, ok := requireSyncV2Device(c, ""); !ok {
		return
	}
	userID := c.MustGet("userId").(uint)
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id=?", userID).Delete(&models.SyncOperation{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id=?", userID).Delete(&models.SyncDevice{}).Error; err != nil {
			return err
		}
		return tx.Where("user_id=?", userID).Delete(&models.SyncAccountState{}).Error
	})
	if err != nil {
		c.JSON(500, gin.H{"code": 500, "message": "重置同步空间失败"})
		return
	}
	c.JSON(200, gin.H{"code": 200, "data": true})
}

func ActivateSyncV2(c *gin.Context) {
	device, ok := requireSyncV2Device(c, "")
	if !ok {
		return
	}
	userID := c.MustGet("userId").(uint)
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var state models.SyncAccountState
		if e := tx.First(&state, "user_id=?", userID).Error; e != nil {
			return e
		}
		if state.ProtocolVersion >= 2 && state.KeyID != device.KeyID {
			return fmt.Errorf("key mismatch")
		}
		state.ProtocolVersion = 2
		state.KeyID = device.KeyID
		state.PendingKeyID = ""
		return tx.Save(&state).Error
	})
	if err != nil {
		c.JSON(409, gin.H{"code": 409, "message": "同步协议启用失败"})
		return
	}
	c.JSON(200, gin.H{"code": 200, "data": true})
}

func rejectLegacyV2(c *gin.Context) bool {
	var state models.SyncAccountState
	if database.DB.First(&state, "user_id=?", c.MustGet("userId")).Error == nil && state.ProtocolVersion >= 2 {
		c.JSON(http.StatusConflict, gin.H{"code": 426, "message": "该账号已启用同步协议 v2，请升级客户端"})
		return true
	}
	return false
}
