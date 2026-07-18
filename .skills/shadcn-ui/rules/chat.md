# Chat & Messaging

Components for conversation and chat UI. Compose these instead of hand-rolling bubbles, scroll containers, dividers, or attachment cards.

Install: `npx shadcn@latest add message-scroller message bubble attachment marker`

The same component names and props ship for both `base` and `radix`; only composition differs (`render` vs `asChild`). See [base-vs-radix.md](./base-vs-radix.md).

## Contents
- Scrollable threads use MessageScroller
- Message rows use Message
- Message surfaces use Bubble
- Attachments use Attachment
- System notes and dividers use Marker
- Streaming, anchoring, and jump-to-latest are built in
- Escape hatch: the scroller hooks

---

## Scrollable threads use MessageScroller

A conversation that scrolls, follows new messages, restores position, or jumps to a message uses `MessageScroller`. Don't build a raw overflow container with manual scroll wiring, and don't reach for `ScrollArea`. The parts nest in a fixed order.

Every direct child of the content is wrapped in a `MessageScrollerItem` so the scroller can measure, anchor, preserve position, track visibility, and jump to it. `MessageScrollerButton` sits inside `MessageScroller`, after the viewport.

**Incorrect:**
```tsx
// Hand-rolled scroll container with manual stick-to-bottom logic.
<div className="overflow-y-auto">
  {messages.map((m) => (
    <div key={m.id}>{m.text}</div>
  ))}
</div>
```

**Correct:**
```tsx
<MessageScroller>
  <MessageScrollerViewport>
    <MessageScrollerContent>
      {messages.map((message) => (
        <MessageScrollerItem key={message.id}>
          {/* ...message content... */}
        </MessageScrollerItem>
      ))}
    </MessageScrollerContent>
  </MessageScrollerViewport>
  <MessageScrollerButton />
</MessageScroller>
```

---

## Message rows use Message

`Message` lays out a single row: avatar, header, content, footer, with alignment. Group consecutive rows from one sender with `MessageGroup`. Don't rebuild the row from flex divs. `align="end"` is the current user's side; `align="start"` is everyone else.

```tsx
<Message align="start">
  <MessageAvatar>{initials}</MessageAvatar>
  <MessageContent>
    <MessageHeader>
      <MessageSender>{sender.name}</MessageSender>
      <MessageTime>{time}</MessageTime>
    </MessageHeader>
    <MessageText>{text}</MessageText>
  </MessageContent>
</Message>
```

---

## Message surfaces use Bubble

The colored message surface is `Bubble` + `BubbleContent`, never a styled `div` with `bg-muted` / `bg-primary` and hand-managed corners.

- `variant`: `default`, `secondary`, `muted`, `tinted`, `outline`, `ghost`, `destructive`.
- `align`: `start` or `end` (matches the `Message` side).

`BubbleReactions` renders the reaction cluster. `side` (`top` | `bottom`) and `align` (`start` | `end`) position it against the bubble. Don't lay reactions out with absolutely-positioned `Badge`s.

**Incorrect:**
```tsx
<div className="bg-muted rounded-lg p-2">{text}</div>
```

**Correct:**
```tsx
<Bubble variant="secondary">
  <BubbleContent>{text}</BubbleContent>
  <BubbleReactions side="bottom" align="end">
    <Badge>👍 2</Badge>
  </BubbleReactions>
</Bubble>
```

---

## Attachments use Attachment

File and image attachments use `Attachment`, not `Item` or a custom card. It carries upload state, so wire `state` to the real status rather than rendering a separate spinner.

- `state`: `idle`, `uploading`, `processing`, `error`, `done`. `uploading` and `processing` apply the `shimmer` animation to the title automatically.
- `size`: `default`, `sm`, `xs`. `orientation`: `horizontal`, `vertical`.
- Use `AttachmentGroup` to lay out several attachments in a scrolling row.

```tsx
<Attachment state="done" href="#">
  <AttachmentPreview>
    <FileIcon />
  </AttachmentPreview>
  <AttachmentContent>
    <AttachmentTitle>homepage-feedback.pdf</AttachmentTitle>
    <AttachmentDescription>PDF · 2.4 MB</AttachmentDescription>
  </AttachmentContent>
</Attachment>
```

For an image, use `<AttachmentPreview>` with an `img` child.

---

## System notes and dividers use Marker

Status lines ("Sarah joined the conversation"), date dividers ("Today"), and labeled separators are `Marker`, not a `Separator` plus a centered span.

- `variant`: `default` (plain row), `separator` (centered label with rules on each side), `border` (bottom-bordered row).
- `MarkerIcon` holds a leading icon; `MarkerContent` holds the label.

**Incorrect:**
```tsx
<div className="text-center text-sm text-muted-foreground">Today</div>
```

**Correct:**
```tsx
<Marker variant="separator">
  <MarkerContent>Today</MarkerContent>
</Marker>
```

---

## Streaming, anchoring, and jump-to-latest are built in

`MessageScroller` handles the behavior that chat UIs usually reinvent. Don't write a `useStickToBottom` hook, a `ResizeObserver`, or manual `scrollTop` math.

- **Follow the live edge while streaming.** `MessageScrollerProvider` with `autoScroll` keeps the view pinned to new content and yields the moment the user scrolls up. Streaming token updates that grow the last message are followed automatically.
- **Anchor a turn.** `scrollAnchor` on a `MessageScrollerItem` marks the row to hold in view (typically the user's message that started the turn).
- **Jump to latest.** `MessageScrollerButton` appears when the user scrolls away and scrolls back on click. `direction="end"` (default) or `direction="start"`. It is a self-managing control, so don't gate it behind your own scroll-position state.

For a "thinking…" indicator while the model generates, apply the `shimmer` utility to text. Don't author a custom keyframe animation. See [styling.md](./styling.md).

---

## Escape hatch: the scroller hooks

For behavior the parts don't expose, read state from the hooks rather than re-implementing the scroller: `useMessageScroller`, `useMessageScrollerVisibility`, and `useMessageScrollerScrollable`. They come from the auto-installed `@shadcn/react` dependency, so there's nothing extra to install. Reach for them only when composition can't express what you need.
