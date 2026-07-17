package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"ranpak-cloud/database"
	"ranpak-cloud/models"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func syncV2TestRouter(method, path string, handler gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("userId", uint(1)); c.Next() })
	r.Handle(method, path, handler)
	return r
}

func initSyncV2TestDB(t *testing.T) {
	t.Helper()
	if database.DB != nil {
		if old, err := database.DB.DB(); err == nil {
			_ = old.Close()
		}
	}
	if err := database.Init(filepath.Join(t.TempDir(), "sync.db")); err != nil {
		t.Fatal(err)
	}
	sqlDB, err := database.DB.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
}

func TestRevokedDeviceCannotPullStatusOrReset(t *testing.T) {
	gin.SetMode(gin.TestMode)
	initSyncV2TestDB(t)
	now := time.Now()
	database.DB.Create(&models.SyncDevice{UserID: 1, DeviceID: "revoked", KeyID: "key", TokenHash: deviceTokenHash("token-token-token-token-token-1234"), RevokedAt: &now, LastSeenAt: now})
	tests := []struct {
		method, path string
		handler      gin.HandlerFunc
	}{{http.MethodGet, "/pull", PullSyncV2}, {http.MethodGet, "/status", SyncV2Status}, {http.MethodDelete, "/space", ResetSyncV2}}
	for _, test := range tests {
		req := httptest.NewRequest(test.method, test.path, nil)
		req.Header.Set("X-RanPak-Device-ID", "revoked")
		req.Header.Set("X-RanPak-Device-Token", "token-token-token-token-token-1234")
		w := httptest.NewRecorder()
		syncV2TestRouter(test.method, test.path, test.handler).ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Fatalf("%s %s returned %d", test.method, test.path, w.Code)
		}
	}
}

func TestDeviceCannotImpersonateAnotherDeviceForPush(t *testing.T) {
	gin.SetMode(gin.TestMode)
	initSyncV2TestDB(t)
	now := time.Now()
	tokenA := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	tokenB := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	database.DB.Create(&models.SyncDevice{UserID: 1, DeviceID: "a", KeyID: "key", TokenHash: deviceTokenHash(tokenA), LastSeenAt: now})
	database.DB.Create(&models.SyncDevice{UserID: 1, DeviceID: "b", KeyID: "key", TokenHash: deviceTokenHash(tokenB), LastSeenAt: now})
	body, _ := json.Marshal(map[string]interface{}{"deviceId": "b", "operations": []interface{}{}})
	req := httptest.NewRequest(http.MethodPost, "/push", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-RanPak-Device-ID", "a")
	req.Header.Set("X-RanPak-Device-Token", tokenA)
	w := httptest.NewRecorder()
	syncV2TestRouter(http.MethodPost, "/push", PushSyncV2).ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("impersonated push returned %d: %s", w.Code, w.Body.String())
	}
}

func TestRegistrationDoesNotActivateProtocolUntilBaselineCompletes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	initSyncV2TestDB(t)
	token := "cccccccccccccccccccccccccccccccc"
	body, _ := json.Marshal(map[string]string{"deviceId": "new-device", "deviceToken": token, "name": "test", "keyId": "key"})
	req := httptest.NewRequest(http.MethodPost, "/devices", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	syncV2TestRouter(http.MethodPost, "/devices", RegisterSyncV2Device).ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("registration returned %d: %s", w.Code, w.Body.String())
	}
	var state models.SyncAccountState
	database.DB.First(&state, "user_id=?", 1)
	if state.ProtocolVersion >= 2 {
		t.Fatal("registration activated v2 before baseline upload")
	}
	req = httptest.NewRequest(http.MethodPost, "/activate", bytes.NewReader([]byte("{}")))
	req.Header.Set("X-RanPak-Device-ID", "new-device")
	req.Header.Set("X-RanPak-Device-Token", token)
	w = httptest.NewRecorder()
	syncV2TestRouter(http.MethodPost, "/activate", ActivateSyncV2).ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("activation returned %d: %s", w.Code, w.Body.String())
	}
	database.DB.First(&state, "user_id=?", 1)
	if state.ProtocolVersion != 2 {
		t.Fatal("activation did not switch protocol")
	}
}
