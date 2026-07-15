package database

import (
	"os"
	"path/filepath"
	"ranpak-cloud/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return err
	}

	if err := db.AutoMigrate(&models.User{}, &models.SyncData{}, &models.ServerSettings{}); err != nil {
		return err
	}

	// user_id + data_type 复合唯一索引
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_user_type ON sync_data(user_id, data_type)")

	// 确保存在默认服务器设置行
	var count int64
	db.Model(&models.ServerSettings{}).Count(&count)
	if count == 0 {
		db.Create(&models.ServerSettings{
			ID:                1,
			AllowRegistration: true,
			RequireApproval:   false,
		})
	}

	DB = db
	return nil
}
