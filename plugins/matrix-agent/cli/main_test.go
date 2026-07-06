package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoginStoresTokenWithoutPrintingIt(t *testing.T) {
	home := t.TempDir()
	t.Setenv("MATRIX_AGENT_HOME", home)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/_matrix/client/v3/login" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.String())
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		if req["password"] != "secret-password" {
			t.Fatalf("password was not read from stdin: %#v", req["password"])
		}
		writeRawJSON(w, `{
			"user_id":"@bot:test",
			"device_id":"DEV1",
			"access_token":"secret-token"
		}`)
	}))
	defer server.Close()

	stdout, stderr, code := runCLI([]string{"login", "--homeserver", server.URL, "--user", "bot", "--password-stdin"}, "secret-password\n")
	if code != 0 {
		t.Fatalf("login failed: code=%d stdout=%s stderr=%s", code, stdout, stderr)
	}
	if strings.Contains(stdout, "secret-token") || strings.Contains(stderr, "secret-token") {
		t.Fatalf("login output leaked access token: stdout=%s stderr=%s", stdout, stderr)
	}

	data, err := os.ReadFile(filepath.Join(home, "session.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "secret-token") {
		t.Fatalf("session did not store token: %s", data)
	}
	info, err := os.Stat(filepath.Join(home, "session.json"))
	if err != nil {
		t.Fatal(err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("session permissions = %v, want 0600", got)
	}
}

func TestUnreadFiltersReadNotifications(t *testing.T) {
	t.Setenv("MATRIX_AGENT_HOME", t.TempDir())

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/_matrix/client/v3/notifications" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.String())
		}
		if r.URL.Query().Get("limit") != "20" {
			t.Fatalf("limit query = %q", r.URL.Query().Get("limit"))
		}
		writeRawJSON(w, `{
			"next_token":"next",
			"notifications":[
				{
					"read":false,
					"room_id":"!room:test",
					"event":{
						"type":"m.room.message",
						"event_id":"$unread",
						"sender":"@alice:test",
						"origin_server_ts":10,
						"content":{"msgtype":"m.text","body":"unread body"}
					}
				},
				{
					"read":true,
					"room_id":"!room:test",
					"event":{
						"type":"m.room.message",
						"event_id":"$read",
						"sender":"@alice:test",
						"origin_server_ts":9,
						"content":{"msgtype":"m.text","body":"read body"}
					}
				}
			]
		}`)
	}))
	defer server.Close()
	writeTestSession(t, server.URL)

	stdout, stderr, code := runCLI([]string{"unread", "--limit", "20"}, "")
	if code != 0 {
		t.Fatalf("unread failed: code=%d stdout=%s stderr=%s", code, stdout, stderr)
	}
	var resp struct {
		NextToken string               `json:"next_token"`
		Items     []notificationOutput `json:"items"`
	}
	decodeJSON(t, stdout, &resp)
	if resp.NextToken != "next" || len(resp.Items) != 1 {
		t.Fatalf("unexpected unread response: %+v", resp)
	}
	if resp.Items[0].Event.EventID != "$unread" || resp.Items[0].Event.Body != "unread body" {
		t.Fatalf("unexpected unread item: %+v", resp.Items[0])
	}
}

func TestDialogsParsesSyncRoomSummaries(t *testing.T) {
	t.Setenv("MATRIX_AGENT_HOME", t.TempDir())

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/_matrix/client/v3/sync" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.String())
		}
		if r.URL.Query().Get("timeout") != "0" {
			t.Fatalf("timeout query = %q", r.URL.Query().Get("timeout"))
		}
		writeRawJSON(w, `{
			"next_batch":"batch1",
			"rooms":{
				"join":{
					"!room:test":{
						"summary":{"m.joined_member_count":2,"m.invited_member_count":1},
						"unread_notifications":{"notification_count":3,"highlight_count":1},
						"state":{"events":[
							{"type":"m.room.name","event_id":"$name","content":{"name":"Ops room"}}
						]},
						"timeline":{"events":[
							{
								"type":"m.room.message",
								"event_id":"$last",
								"sender":"@bob:test",
								"origin_server_ts":123,
								"content":{"msgtype":"m.text","body":"latest body"}
							}
						]}
					}
				}
			}
		}`)
	}))
	defer server.Close()
	writeTestSession(t, server.URL)

	stdout, stderr, code := runCLI([]string{"dialogs", "--limit", "5"}, "")
	if code != 0 {
		t.Fatalf("dialogs failed: code=%d stdout=%s stderr=%s", code, stdout, stderr)
	}
	var resp struct {
		NextBatch string         `json:"next_batch"`
		Items     []dialogOutput `json:"items"`
	}
	decodeJSON(t, stdout, &resp)
	if resp.NextBatch != "batch1" || len(resp.Items) != 1 {
		t.Fatalf("unexpected dialogs response: %+v", resp)
	}
	item := resp.Items[0]
	if item.RoomID != "!room:test" || item.Name != "Ops room" || item.LastEvent.Body != "latest body" {
		t.Fatalf("unexpected dialog item: %+v", item)
	}
	if item.NotificationCount != 3 || item.HighlightCount != 1 || item.JoinedMemberCount != 2 || item.InvitedMemberCount != 1 {
		t.Fatalf("unexpected counts: %+v", item)
	}
}

func TestReadAndSearchExtractMessageBodies(t *testing.T) {
	t.Setenv("MATRIX_AGENT_HOME", t.TempDir())
	const roomID = "!room:test"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && strings.Contains(r.URL.Path, "/rooms/") && strings.HasSuffix(r.URL.Path, "/messages"):
			writeRawJSON(w, `{
				"start":"s1",
				"end":"s0",
				"chunk":[
					{
						"type":"m.room.message",
						"room_id":"!room:test",
						"event_id":"$read",
						"sender":"@carol:test",
						"origin_server_ts":55,
						"content":{"msgtype":"m.text","body":"read body"}
					}
				]
			}`)
		case r.Method == http.MethodPost && r.URL.Path == "/_matrix/client/v3/search":
			var req struct {
				SearchCategories struct {
					RoomEvents struct {
						SearchTerm string `json:"search_term"`
						Filter     struct {
							Rooms []string `json:"rooms"`
						} `json:"filter"`
					} `json:"room_events"`
				} `json:"search_categories"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				t.Fatal(err)
			}
			if req.SearchCategories.RoomEvents.SearchTerm != "needle" {
				t.Fatalf("search term = %q", req.SearchCategories.RoomEvents.SearchTerm)
			}
			if len(req.SearchCategories.RoomEvents.Filter.Rooms) != 1 || req.SearchCategories.RoomEvents.Filter.Rooms[0] != roomID {
				t.Fatalf("search rooms filter = %#v", req.SearchCategories.RoomEvents.Filter.Rooms)
			}
			writeRawJSON(w, `{
				"search_categories":{
					"room_events":{
						"count":1,
						"next_batch":"n1",
						"results":[
							{
								"result":{
									"type":"m.room.message",
									"room_id":"!room:test",
									"event_id":"$search",
									"sender":"@carol:test",
									"origin_server_ts":77,
									"content":{"msgtype":"m.text","body":"search body"}
								}
							}
						]
					}
				}
			}`)
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.String())
		}
	}))
	defer server.Close()
	writeTestSession(t, server.URL)

	stdout, stderr, code := runCLI([]string{"read", roomID, "--limit", "10"}, "")
	if code != 0 {
		t.Fatalf("read failed: code=%d stdout=%s stderr=%s", code, stdout, stderr)
	}
	var readResp struct {
		Items []eventOutput `json:"items"`
	}
	decodeJSON(t, stdout, &readResp)
	if len(readResp.Items) != 1 || readResp.Items[0].Body != "read body" {
		t.Fatalf("unexpected read response: %+v", readResp)
	}

	stdout, stderr, code = runCLI([]string{"search", roomID, "needle", "--limit", "10"}, "")
	if code != 0 {
		t.Fatalf("search failed: code=%d stdout=%s stderr=%s", code, stdout, stderr)
	}
	var searchResp struct {
		Items []eventOutput `json:"items"`
	}
	decodeJSON(t, stdout, &searchResp)
	if len(searchResp.Items) != 1 || searchResp.Items[0].Body != "search body" {
		t.Fatalf("unexpected search response: %+v", searchResp)
	}
}

func TestSendUsesUniqueTxnID(t *testing.T) {
	t.Setenv("MATRIX_AGENT_HOME", t.TempDir())
	var firstTxn string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut || !strings.Contains(r.URL.Path, "/send/m.room.message/") {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.String())
		}
		txn := r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]
		if txn == "" {
			t.Fatal("empty txn id")
		}
		if firstTxn == "" {
			firstTxn = txn
		} else if firstTxn == txn {
			t.Fatalf("txn id was reused: %s", txn)
		}
		var req struct {
			MsgType string `json:"msgtype"`
			Body    string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		if req.MsgType != "m.text" || req.Body != "hello" {
			t.Fatalf("unexpected send body: %+v", req)
		}
		writeRawJSON(w, `{"event_id":"$sent"}`)
	}))
	defer server.Close()
	writeTestSession(t, server.URL)

	for i := 0; i < 2; i++ {
		stdout, stderr, code := runCLI([]string{"send", "!room:test", "--stdin"}, "hello\n")
		if code != 0 {
			t.Fatalf("send failed: code=%d stdout=%s stderr=%s", code, stdout, stderr)
		}
		var resp struct {
			EventID string `json:"event_id"`
		}
		decodeJSON(t, stdout, &resp)
		if resp.EventID != "$sent" {
			t.Fatalf("event_id = %q", resp.EventID)
		}
	}
}

func TestJoinRoomByID(t *testing.T) {
	t.Setenv("MATRIX_AGENT_HOME", t.TempDir())
	called := false

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !strings.Contains(r.URL.Path, "/rooms/") || !strings.HasSuffix(r.URL.Path, "/join") {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.String())
		}
		called = true
		writeRawJSON(w, `{"room_id":"!room:test"}`)
	}))
	defer server.Close()
	writeTestSession(t, server.URL)

	stdout, stderr, code := runCLI([]string{"join", "!room:test"}, "")
	if code != 0 {
		t.Fatalf("join failed: code=%d stdout=%s stderr=%s", code, stdout, stderr)
	}
	if !called {
		t.Fatal("join endpoint was not called")
	}
	var resp struct {
		OK     bool   `json:"ok"`
		RoomID string `json:"room_id"`
	}
	decodeJSON(t, stdout, &resp)
	if !resp.OK || resp.RoomID != "!room:test" {
		t.Fatalf("unexpected join response: %+v", resp)
	}
}

func TestAckSendsReadReceipt(t *testing.T) {
	t.Setenv("MATRIX_AGENT_HOME", t.TempDir())
	called := false

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !strings.Contains(r.URL.Path, "/receipt/m.read/") {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.String())
		}
		called = true
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		if len(req) != 0 {
			t.Fatalf("read receipt body = %#v", req)
		}
		writeRawJSON(w, `{}`)
	}))
	defer server.Close()
	writeTestSession(t, server.URL)

	stdout, stderr, code := runCLI([]string{"ack", "!room:test", "--event", "$event"}, "")
	if code != 0 {
		t.Fatalf("ack failed: code=%d stdout=%s stderr=%s", code, stdout, stderr)
	}
	if !called {
		t.Fatal("read receipt endpoint was not called")
	}
	var resp struct {
		OK      bool   `json:"ok"`
		EventID string `json:"event_id"`
	}
	decodeJSON(t, stdout, &resp)
	if !resp.OK || resp.EventID != "$event" {
		t.Fatalf("unexpected ack response: %+v", resp)
	}
}

func runCLI(args []string, stdin string) (string, string, int) {
	var stdout, stderr bytes.Buffer
	code := run(args, strings.NewReader(stdin), &stdout, &stderr)
	return stdout.String(), stderr.String(), code
}

func writeTestSession(t *testing.T, homeserver string) {
	t.Helper()
	if err := saveSession(session{
		Homeserver:  homeserver,
		UserID:      "@bot:test",
		DeviceID:    "DEV1",
		AccessToken: "test-token",
	}); err != nil {
		t.Fatal(err)
	}
}

func writeRawJSON(w http.ResponseWriter, body string) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(body))
}

func decodeJSON(t *testing.T, raw string, dst any) {
	t.Helper()
	if err := json.Unmarshal([]byte(raw), dst); err != nil {
		t.Fatalf("decode JSON: %v\n%s", err, raw)
	}
}
