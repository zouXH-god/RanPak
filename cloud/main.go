package main

import (
	"log"
	"ranpak-cloud/config"
	"ranpak-cloud/database"
	"ranpak-cloud/handlers"
	"ranpak-cloud/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	if err := database.Init(cfg.DBPath); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	if cfg.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	r.Use(middleware.CORS())

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		auth.Use(func(c *gin.Context) {
			c.Set("jwtSecret", cfg.JWTSecret)
			c.Next()
		})
		{
			auth.POST("/register", handlers.Register)
			auth.POST("/login", handlers.Login)
		}

		authProtected := api.Group("/auth")
		authProtected.Use(middleware.JWTAuth(cfg.JWTSecret))
		{
			authProtected.POST("/totp/setup", handlers.TOTPSetup)
			authProtected.POST("/totp/enable", handlers.TOTPEnable)
			authProtected.POST("/totp/disable", handlers.TOTPDisable)
		}

		sync := api.Group("/sync")
		sync.Use(middleware.JWTAuth(cfg.JWTSecret))
		{
			sync.GET("/status", handlers.GetSyncStatus)
			sync.GET("/all", handlers.GetAllSyncData)
			sync.GET("/:type", handlers.GetSyncData)
			sync.POST("/:type/merge", handlers.MergeSyncData)
		}

		admin := api.Group("/admin")
		admin.Use(middleware.JWTAuth(cfg.JWTSecret))
		admin.Use(middleware.RequireAdmin())
		{
			admin.GET("/settings", handlers.GetServerSettings)
			admin.PUT("/settings", handlers.UpdateServerSettings)
			admin.GET("/users", handlers.ListUsers)
			admin.POST("/users", handlers.CreateUser)
			admin.PUT("/users/:id", handlers.UpdateUser)
			admin.PUT("/users/:id/approve", handlers.ApproveUser)
			admin.DELETE("/users/:id", handlers.DeleteUser)
		}
	}

	log.Printf("云端同步服务启动于 :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
