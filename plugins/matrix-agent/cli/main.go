package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"maunium.net/go/mautrix"
	"maunium.net/go/mautrix/event"
	"maunium.net/go/mautrix/id"
)

const appName = "matrix-agent"

type session struct {
	Homeserver  string `json:"homeserver"`
	UserID      string `json:"user_id"`
	DeviceID    string `json:"device_id"`
	AccessToken string `json:"access_token"`
}

type eventOutput struct {
	RoomID    string `json:"room_id,omitempty"`
	EventID   string `json:"event_id,omitempty"`
	Sender    string `json:"sender,omitempty"`
	Type      string `json:"type"`
	Timestamp int64  `json:"origin_server_ts,omitempty"`
	Body      string `json:"body,omitempty"`
	MsgType   string `json:"msgtype,omitempty"`
	Encrypted bool   `json:"encrypted,omitempty"`
}

type notificationOutput struct {
	Read    bool        `json:"read"`
	Actions []any       `json:"actions,omitempty"`
	Event   eventOutput `json:"event"`
}

type dialogOutput struct {
	RoomID             string      `json:"room_id"`
	Name               string      `json:"name,omitempty"`
	LastEvent          eventOutput `json:"last_event,omitempty"`
	NotificationCount  int         `json:"notification_count,omitempty"`
	HighlightCount     int         `json:"highlight_count,omitempty"`
	JoinedMemberCount  int         `json:"joined_member_count,omitempty"`
	InvitedMemberCount int         `json:"invited_member_count,omitempty"`
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr))
}

func run(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	if len(args) == 0 || args[0] == "-h" || args[0] == "--help" {
		printUsage(stdout)
		return 0
	}
	if err := runCommand(context.Background(), args, stdin, stdout); err != nil {
		_ = json.NewEncoder(stderr).Encode(map[string]string{"error": err.Error()})
		return 1
	}
	return 0
}

func runCommand(ctx context.Context, args []string, stdin io.Reader, stdout io.Writer) error {
	switch args[0] {
	case "login":
		return cmdLogin(ctx, args[1:], stdin, stdout)
	case "whoami":
		return cmdWhoami(stdout)
	case "unread":
		return cmdUnread(ctx, args[1:], stdout)
	case "dialogs":
		return cmdDialogs(ctx, args[1:], stdout)
	case "read":
		return cmdRead(ctx, args[1:], stdout)
	case "search":
		return cmdSearch(ctx, args[1:], stdout)
	case "send":
		return cmdSend(ctx, args[1:], stdin, stdout)
	case "join":
		return cmdJoin(ctx, args[1:], stdout)
	case "ack":
		return cmdAck(ctx, args[1:], stdout)
	case "logout":
		return cmdLogout(ctx, stdout)
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func cmdLogin(ctx context.Context, args []string, stdin io.Reader, stdout io.Writer) error {
	fs := flag.NewFlagSet("login", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	homeserver := fs.String("homeserver", "", "Matrix homeserver URL or host")
	user := fs.String("user", "", "Matrix login")
	passwordStdin := fs.Bool("password-stdin", false, "read password from stdin")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *homeserver == "" || *user == "" || !*passwordStdin {
		return errors.New("usage: matrix-agent login --homeserver <url-or-host> --user <login> --password-stdin")
	}
	passwordBytes, err := io.ReadAll(stdin)
	if err != nil {
		return err
	}
	password := strings.TrimRight(string(passwordBytes), "\r\n")
	if password == "" {
		return errors.New("empty password")
	}
	hs := normalizeHomeserver(*homeserver)
	cli, err := mautrix.NewClient(hs, "", "")
	if err != nil {
		return err
	}
	resp, err := cli.Login(ctx, &mautrix.ReqLogin{
		Type: mautrix.AuthTypePassword,
		Identifier: mautrix.UserIdentifier{
			Type: mautrix.IdentifierTypeUser,
			User: *user,
		},
		Password:                 password,
		InitialDeviceDisplayName: appName,
		StoreCredentials:         true,
		StoreHomeserverURL:       true,
	})
	if err != nil {
		return err
	}
	s := session{
		Homeserver:  cli.HomeserverURL.String(),
		UserID:      resp.UserID.String(),
		DeviceID:    resp.DeviceID.String(),
		AccessToken: resp.AccessToken,
	}
	if s.Homeserver == "" {
		s.Homeserver = hs
	}
	if err := saveSession(s); err != nil {
		return err
	}
	return writeJSON(stdout, map[string]any{
		"ok":           true,
		"homeserver":   s.Homeserver,
		"user_id":      s.UserID,
		"device_id":    s.DeviceID,
		"token_stored": true,
	})
}

func cmdWhoami(stdout io.Writer) error {
	s, err := loadSession()
	if err != nil {
		return err
	}
	return writeJSON(stdout, map[string]any{
		"homeserver": s.Homeserver,
		"user_id":    s.UserID,
		"device_id":  s.DeviceID,
	})
}

func cmdUnread(ctx context.Context, args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("unread", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	limit := fs.Int("limit", 20, "maximum notifications")
	from := fs.String("from", "", "pagination token")
	if err := fs.Parse(args); err != nil {
		return err
	}
	cli, _, err := authedClient()
	if err != nil {
		return err
	}
	query := map[string]string{"limit": strconv.Itoa(positiveLimit(*limit, 20))}
	if *from != "" {
		query["from"] = *from
	}
	var resp struct {
		NextToken     string `json:"next_token,omitempty"`
		Notifications []struct {
			Actions []any       `json:"actions"`
			Event   event.Event `json:"event"`
			Read    bool        `json:"read"`
			RoomID  id.RoomID   `json:"room_id"`
		} `json:"notifications"`
	}
	u := cli.BuildURLWithQuery(mautrix.ClientURLPath{"v3", "notifications"}, query)
	if _, err := cli.MakeRequest(ctx, http.MethodGet, u, nil, &resp); err != nil {
		return err
	}
	out := make([]notificationOutput, 0, len(resp.Notifications))
	for _, n := range resp.Notifications {
		if n.Read {
			continue
		}
		if n.Event.RoomID == "" {
			n.Event.RoomID = n.RoomID
		}
		out = append(out, notificationOutput{
			Read:    n.Read,
			Actions: n.Actions,
			Event:   renderEvent(n.Event),
		})
	}
	return writeJSON(stdout, map[string]any{"next_token": resp.NextToken, "items": out})
}

func cmdDialogs(ctx context.Context, args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("dialogs", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	limit := fs.Int("limit", 20, "maximum rooms")
	if err := fs.Parse(args); err != nil {
		return err
	}
	cli, _, err := authedClient()
	if err != nil {
		return err
	}
	var resp syncResponse
	u := cli.BuildURLWithQuery(mautrix.ClientURLPath{"v3", "sync"}, map[string]string{"timeout": "0"})
	if _, err := cli.MakeRequest(ctx, http.MethodGet, u, nil, &resp); err != nil {
		return err
	}
	items := dialogsFromSync(resp)
	sort.SliceStable(items, func(i, j int) bool {
		return items[i].LastEvent.Timestamp > items[j].LastEvent.Timestamp
	})
	if max := positiveLimit(*limit, 20); len(items) > max {
		items = items[:max]
	}
	return writeJSON(stdout, map[string]any{"next_batch": resp.NextBatch, "items": items})
}

func cmdRead(ctx context.Context, args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("read", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	limit := fs.Int("limit", 50, "maximum events")
	from := fs.String("from", "", "pagination token")
	args = flagsFirst(args, map[string]bool{"limit": true, "from": true})
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() != 1 {
		return errors.New("usage: matrix-agent read <room_id> --limit 50 [--from token]")
	}
	cli, _, err := authedClient()
	if err != nil {
		return err
	}
	resp, err := cli.Messages(ctx, id.RoomID(fs.Arg(0)), *from, "", mautrix.DirectionBackward, messageFilter(positiveLimit(*limit, 50)), positiveLimit(*limit, 50))
	if err != nil {
		return err
	}
	items := make([]eventOutput, 0, len(resp.Chunk))
	for _, evt := range resp.Chunk {
		if evt != nil {
			items = append(items, renderEvent(*evt))
		}
	}
	return writeJSON(stdout, map[string]any{"start": resp.Start, "end": resp.End, "items": items})
}

func cmdSearch(ctx context.Context, args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("search", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	limit := fs.Int("limit", 200, "maximum results")
	args = flagsFirst(args, map[string]bool{"limit": true})
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() != 2 {
		return errors.New("usage: matrix-agent search <room_id> <query> --limit 200")
	}
	cli, _, err := authedClient()
	if err != nil {
		return err
	}
	resp, err := cli.Search(ctx, &mautrix.ReqSearch{
		SearchTerm: fs.Arg(1),
		Filter:     roomMessageFilter(id.RoomID(fs.Arg(0)), positiveLimit(*limit, 200)),
		Keys:       []string{"content.body"},
		OrderBy:    "recent",
	})
	if err != nil {
		return err
	}
	if resp == nil {
		return writeJSON(stdout, map[string]any{"count": 0, "next_batch": "", "items": []eventOutput{}})
	}
	roomID := id.RoomID(fs.Arg(0))
	items := make([]eventOutput, 0, len(resp.Results))
	for _, result := range resp.Results {
		if result == nil || result.Event == nil || result.Event.RoomID != roomID {
			continue
		}
		items = append(items, renderEvent(*result.Event))
	}
	return writeJSON(stdout, map[string]any{
		"count":      resp.Count,
		"next_batch": resp.NextBatch,
		"items":      items,
	})
}

func cmdSend(ctx context.Context, args []string, stdin io.Reader, stdout io.Writer) error {
	fs := flag.NewFlagSet("send", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	bodyStdin := fs.Bool("stdin", false, "read message body from stdin")
	args = flagsFirst(args, map[string]bool{})
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() != 1 || !*bodyStdin {
		return errors.New("usage: matrix-agent send <room_id> --stdin")
	}
	bodyBytes, err := io.ReadAll(stdin)
	if err != nil {
		return err
	}
	body := strings.TrimRight(string(bodyBytes), "\r\n")
	if body == "" {
		return errors.New("empty message")
	}
	cli, _, err := authedClient()
	if err != nil {
		return err
	}
	resp, err := cli.SendText(ctx, id.RoomID(fs.Arg(0)), body)
	if err != nil {
		return err
	}
	return writeJSON(stdout, map[string]any{"event_id": resp.EventID.String()})
}

func cmdJoin(ctx context.Context, args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("join", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() != 1 {
		return errors.New("usage: matrix-agent join <room_id>")
	}
	cli, _, err := authedClient()
	if err != nil {
		return err
	}
	resp, err := cli.JoinRoomByID(ctx, id.RoomID(fs.Arg(0)))
	if err != nil {
		return err
	}
	return writeJSON(stdout, map[string]any{"ok": true, "room_id": resp.RoomID.String()})
}

func cmdAck(ctx context.Context, args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("ack", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	eventID := fs.String("event", "", "event id to mark read")
	args = flagsFirst(args, map[string]bool{"event": true})
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() != 1 {
		return errors.New("usage: matrix-agent ack <room_id> [--event <event_id>]")
	}
	cli, _, err := authedClient()
	if err != nil {
		return err
	}
	roomID := id.RoomID(fs.Arg(0))
	target := id.EventID(*eventID)
	if target == "" {
		target, err = latestEventID(ctx, cli, roomID)
		if err != nil {
			return err
		}
	}
	if target == "" {
		return errors.New("no event to acknowledge")
	}
	if err := cli.MarkRead(ctx, roomID, target); err != nil {
		return err
	}
	return writeJSON(stdout, map[string]any{"ok": true, "room_id": roomID.String(), "event_id": target.String()})
}

func cmdLogout(ctx context.Context, stdout io.Writer) error {
	cli, _, err := authedClient()
	if err != nil {
		return err
	}
	if _, err := cli.Logout(ctx); err != nil {
		return err
	}
	if err := os.Remove(sessionFile()); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return writeJSON(stdout, map[string]bool{"ok": true})
}

type syncResponse struct {
	NextBatch string `json:"next_batch"`
	Rooms     struct {
		Join map[string]joinedRoom `json:"join"`
	} `json:"rooms"`
}

type joinedRoom struct {
	Summary struct {
		JoinedMemberCount  int `json:"m.joined_member_count"`
		InvitedMemberCount int `json:"m.invited_member_count"`
	} `json:"summary"`
	UnreadNotifications struct {
		NotificationCount int `json:"notification_count"`
		HighlightCount    int `json:"highlight_count"`
	} `json:"unread_notifications"`
	State struct {
		Events []event.Event `json:"events"`
	} `json:"state"`
	Timeline struct {
		Events []event.Event `json:"events"`
	} `json:"timeline"`
}

func dialogsFromSync(resp syncResponse) []dialogOutput {
	items := make([]dialogOutput, 0, len(resp.Rooms.Join))
	for roomID, room := range resp.Rooms.Join {
		last := lastEvent(room.Timeline.Events)
		if last.RoomID == "" {
			last.RoomID = id.RoomID(roomID)
		}
		items = append(items, dialogOutput{
			RoomID:             roomID,
			Name:               roomName(room.State.Events, room.Timeline.Events),
			LastEvent:          renderEvent(last),
			NotificationCount:  room.UnreadNotifications.NotificationCount,
			HighlightCount:     room.UnreadNotifications.HighlightCount,
			JoinedMemberCount:  room.Summary.JoinedMemberCount,
			InvitedMemberCount: room.Summary.InvitedMemberCount,
		})
	}
	return items
}

func lastEvent(events []event.Event) event.Event {
	for i := len(events) - 1; i >= 0; i-- {
		if events[i].ID != "" {
			return events[i]
		}
	}
	return event.Event{}
}

func roomName(groups ...[]event.Event) string {
	for _, events := range groups {
		for _, evt := range events {
			if evt.Type.Type == "m.room.name" {
				if name, ok := evt.Content.Raw["name"].(string); ok {
					return name
				}
			}
		}
	}
	return ""
}

func latestEventID(ctx context.Context, cli *mautrix.Client, roomID id.RoomID) (id.EventID, error) {
	resp, err := cli.Messages(ctx, roomID, "", "", mautrix.DirectionBackward, messageFilter(1), 1)
	if err != nil {
		return "", err
	}
	for _, evt := range resp.Chunk {
		if evt != nil && evt.ID != "" {
			return evt.ID, nil
		}
	}
	return "", nil
}

func renderEvent(evt event.Event) eventOutput {
	out := eventOutput{
		RoomID:    evt.RoomID.String(),
		EventID:   evt.ID.String(),
		Sender:    evt.Sender.String(),
		Type:      evt.Type.Type,
		Timestamp: evt.Timestamp,
	}
	switch evt.Type.Type {
	case event.EventMessage.Type:
		if body, msgType := messageBody(evt); body != "" || msgType != "" {
			out.Body = body
			out.MsgType = msgType
		}
	case event.EventEncrypted.Type:
		// ponytail: no E2EE in v1; add cryptohelper/goolm when encrypted rooms are required.
		out.Encrypted = true
	}
	return out
}

func messageBody(evt event.Event) (string, string) {
	if err := evt.Content.ParseRaw(evt.Type); err == nil {
		msg := evt.Content.AsMessage()
		if msg != nil {
			return msg.Body, string(msg.MsgType)
		}
	}
	raw := evt.Content.GetRaw()
	body, _ := raw["body"].(string)
	msgType, _ := raw["msgtype"].(string)
	return body, msgType
}

func messageFilter(limit int) *mautrix.FilterPart {
	return &mautrix.FilterPart{
		Limit: limit,
		Types: []event.Type{event.EventMessage, event.EventEncrypted},
	}
}

func roomMessageFilter(roomID id.RoomID, limit int) *mautrix.FilterPart {
	filter := messageFilter(limit)
	filter.Rooms = []id.RoomID{roomID}
	return filter
}

func authedClient() (*mautrix.Client, session, error) {
	s, err := loadSession()
	if err != nil {
		return nil, session{}, err
	}
	cli, err := mautrix.NewClient(s.Homeserver, id.UserID(s.UserID), s.AccessToken)
	if err != nil {
		return nil, session{}, err
	}
	cli.DeviceID = id.DeviceID(s.DeviceID)
	return cli, s, nil
}

func normalizeHomeserver(homeserver string) string {
	homeserver = strings.TrimSpace(homeserver)
	if strings.HasPrefix(homeserver, "http://") || strings.HasPrefix(homeserver, "https://") {
		return homeserver
	}
	return "https://" + homeserver
}

func positiveLimit(n, fallback int) int {
	if n <= 0 {
		return fallback
	}
	return n
}

func flagsFirst(args []string, takesValue map[string]bool) []string {
	flags := make([]string, 0, len(args))
	positionals := make([]string, 0, len(args))
	for i := 0; i < len(args); i++ {
		arg := args[i]
		if !strings.HasPrefix(arg, "-") || arg == "-" {
			positionals = append(positionals, arg)
			continue
		}
		flags = append(flags, arg)
		name := strings.TrimLeft(arg, "-")
		if eq := strings.IndexByte(name, '='); eq >= 0 {
			name = name[:eq]
		}
		if takesValue[name] && !strings.Contains(arg, "=") && i+1 < len(args) {
			i++
			flags = append(flags, args[i])
		}
	}
	return append(flags, positionals...)
}

func sessionDir() string {
	if home := strings.TrimSpace(os.Getenv("MATRIX_AGENT_HOME")); home != "" {
		return home
	}
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		return "." + appName
	}
	return filepath.Join(dir, appName)
}

func sessionFile() string {
	return filepath.Join(sessionDir(), "session.json")
}

func saveSession(s session) error {
	dir := sessionDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	path := sessionFile()
	_ = os.Remove(path)
	if err := os.WriteFile(path, append(data, '\n'), 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func loadSession() (session, error) {
	data, err := os.ReadFile(sessionFile())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return session{}, errors.New("not logged in")
		}
		return session{}, err
	}
	var s session
	if err := json.Unmarshal(data, &s); err != nil {
		return session{}, err
	}
	if s.Homeserver == "" || s.UserID == "" || s.AccessToken == "" {
		return session{}, errors.New("session is incomplete")
	}
	return s, nil
}

func writeJSON(w io.Writer, v any) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

func printUsage(w io.Writer) {
	fmt.Fprintln(w, `matrix-agent commands:
  login --homeserver <url-or-host> --user <login> --password-stdin
  whoami
  unread --limit 20 [--from token]
  dialogs --limit 20
  read <room_id> --limit 50 [--from token]
  search <room_id> <query> --limit 200
  send <room_id> --stdin
  join <room_id>
  ack <room_id> [--event <event_id>]
  logout`)
}
