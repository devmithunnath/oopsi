# Theming `@oopsi/react`

Import `@oopsi/react/styles.css` once, then override any CSS variable on `.oopsi-root`:

```css
.oopsi-root {
  --oopsi-bg: #0c0d10;
  --oopsi-surface: #14161b;
  --oopsi-border: #22252d;
  --oopsi-text: #eceef2;
  --oopsi-muted: #9ba1ad;
  --oopsi-accent: #b9f26b;
  --oopsi-accent-ink: #0c0d10;
  --oopsi-success: #b9f26b;
  --oopsi-radius: 14px;
}
```

Pass `theme="light"` to `<SupportForm />` or `<TicketThread />` for the built-in light preset.
