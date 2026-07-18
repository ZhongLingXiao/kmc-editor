# Forms & Inputs

## Contents
- Forms use FieldGroup + Field
- InputGroup requires InputGroupInput/InputGroupTextarea
- Buttons inside inputs use InputGroup + InputGroupAddon
- Option sets (2–7 choices) use ToggleGroup
- FieldSet + FieldLegend for grouping related fields
- Field validation and disabled states

---

## Forms use FieldGroup + Field

Always use `FieldGroup` + `Field` — never raw `div` with `space-y-*`:

```tsx
<FieldGroup>
  <Field>
    <FieldLabel>Email</FieldLabel>
    <Input />
  </Field>
  <Field>
    <FieldLabel>Password</FieldLabel>
    <Input type="password" />
  </Field>
</FieldGroup>
```

Use `Field orientation="horizontal"` for settings pages. Use `FieldLabel className="sr-only"` for visually hidden labels.

**Choosing form controls:**
- Simple text input → `Input`
- Dropdown with predefined options → `Select`
- Searchable dropdown → `Combobox`
- Native HTML select (no JS) → `native-select`
- Boolean toggle → `Switch` (for settings) or `Checkbox` (for forms)
- Single choice from few options → `RadioGroup`
- Toggle between 2–5 options → `ToggleGroup` + `ToggleGroupItem`
- OTP/verification code → `InputOTP`
- Multi-line text → `Textarea`

---

## InputGroup requires InputGroupInput/InputGroupTextarea

Never use raw `Input` or `Textarea` inside an `InputGroup`.

**Incorrect:**
```tsx
<InputGroup>
  <Input />
</InputGroup>
```

**Correct:**
```tsx
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"

<InputGroup>
  <InputGroupInput />
</InputGroup>
```

---

## Buttons inside inputs use InputGroup + InputGroupAddon

Never place a `Button` directly inside or adjacent to an `Input` with custom positioning.

**Incorrect:**
```tsx
<div className="relative">
  <Input />
  <Button className="absolute right-0" />
</div>
```

**Correct:**
```tsx
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"

<InputGroup>
  <InputGroupInput />
  <InputGroupAddon>
    <Button>Search</Button>
  </InputGroupAddon>
</InputGroup>
```

---

## Option sets (2–7 choices) use ToggleGroup

Don't manually loop `Button` components with active state.

**Incorrect:**
```tsx
const [selected, setSelected] = useState("daily")
{["daily", "weekly", "monthly"].map((option) => (
  <Button key={option} onClick={() => setSelected(option)}>{option}</Button>
))}
```

**Correct:**
```tsx
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

<ToggleGroup type="single" defaultValue="daily">
  <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
  <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
  <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
</ToggleGroup>
```

Combine with `Field` for labelled toggle groups:
```tsx
<Field>
  <FieldLabel>Theme</FieldLabel>
  <ToggleGroup type="single" defaultValue="light">
    <ToggleGroupItem value="light">Light</ToggleGroupItem>
    <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
    <ToggleGroupItem value="system">System</ToggleGroupItem>
  </ToggleGroup>
</Field>
```

> **Note:** `defaultValue` and `type`/`multiple` props differ between base and radix. See [base-vs-radix.md](./base-vs-radix.md#togglegroup).

---

## FieldSet + FieldLegend for grouping related fields

Use `FieldSet` + `FieldLegend` for related checkboxes, radios, or switches — not `div` with a heading:

```tsx
<FieldSet>
  <FieldLegend>Preferences</FieldLegend>
  <FieldLabel>
    <Checkbox /> Select all that apply.
  </FieldLabel>
  <FieldLabel>
    <Checkbox /> Dark mode
  </FieldLabel>
</FieldSet>
```

---

## Field validation and disabled states

Both attributes are needed — `data-invalid`/`data-disabled` styles the field (label, description), while `aria-invalid`/`disabled` styles the control.

```tsx
// Invalid.
<Field data-invalid>
  <FieldLabel>Email</FieldLabel>
  <Input aria-invalid />
  <FieldDescription>Invalid email address.</FieldDescription>
</Field>

// Disabled.
<Field data-disabled>
  <FieldLabel>Email</FieldLabel>
  <Input disabled />
</Field>
```

Works for all controls: `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroupItem`, `Switch`, `Slider`, `NativeSelect`, `InputOTP`.
