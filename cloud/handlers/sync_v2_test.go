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

func TestSyncV2StatusReturnsLatestEntityOverview(t *testing.T) {
	gin.SetMode(gin.TestMode)
	initSyncV2TestDB(t)
	now := time.Now()
	token := "dddddddddddddddddddddddddddddddd"
	database.DB.Create(&models.SyncDevice{UserID: 1, DeviceID: "device", KeyID: "key", TokenHash: deviceTokenHash(token), LastSeenAt: now})
	database.DB.Create(&models.SyncAccountState{UserID: 1, ProtocolVersion: 2, KeyID: "key"})
	rows := []models.SyncOperation{
		{UserID: 1, OpID: "ssh-1", DeviceID: "device", EntityType: "ssh_profile", EntityID: "one", ContentHash: "a", Envelope: "{}"},
		{UserID: 1, OpID: "ssh-2", DeviceID: "device", EntityType: "ssh_profile", EntityID: "two", ContentHash: "b", Envelope: "{}"},
		{UserID: 1, OpID: "ssh-2-delete", DeviceID: "device", EntityType: "ssh_profile", EntityID: "two", ContentHash: "c", Deleted: true, Envelope: "{}"},
		{UserID: 1, OpID: "dns-1", DeviceID: "device", EntityType: "dns_account", EntityID: "one", ContentHash: "d", Envelope: "{}"},
		{UserID: 1, OpID: "ai-1", DeviceID: "device", EntityType: "app_config", EntityID: "ai", ContentHash: "e", Envelope: "{}"},
	}
	for i := range rows {
		database.DB.Create(&rows[i])
	}
	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	req.Header.Set("X-RanPak-Device-ID", "device")
	req.Header.Set("X-RanPak-Device-Token", token)
	w := httptest.NewRecorder()
	syncV2TestRouter(http.MethodGet, "/status", SyncV2Status).ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status returned %d: %s", w.Code, w.Body.String())
	}
	var response struct {
		Data struct {
			Overview map[string]struct {
				Count int64 `json:"count"`
			} `json:"overview"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Data.Overview["ssh_profiles"].Count != 1 || response.Data.Overview["dns_accounts"].Count != 1 || response.Data.Overview["ai_config"].Count != 1 {
		t.Fatalf("unexpected overview: %s", w.Body.String())
	}
}
