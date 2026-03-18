# Journey Navigation & Wireframe (v1)

## 1. Top-level IA

- Arena
- Growth
- My Page

Journey belongs under **Growth**.

**Growth contains:**

- Dojo
- Integrity
- Guidance
- Journey

---

## 2. Entry Flow

### Flow 1 — comeback trigger

App open  
→ system detects 3+ day inactivity  
→ comeback modal  
→ CTA: Resume Journey  
→ `POST /api/journey/bounce-back`  
→ JourneyBoard opens  
→ continue `current_day` path  

### Flow 2 — manual Growth entry

Growth  
→ Journey card  
→ JourneyBoard opens  
→ continue `current_day` path  

### Flow 3 — deep link

Deep link  
→ JourneyBoard opens  
→ continue `current_day` path  

---

## 3. Comeback Modal

### Purpose

- detect interruption
- invite recovery
- re-enter Journey

### Copy

System detected interruption.  
Resume your Journey from the current path.

### Actions

- Resume Journey
- Close

### Behavior

- **Resume Journey** → record bounce-back
- **Close** → no bounce-back record

---

## 4. JourneyBoard Wireframe

```
[ HEADER ]
Journey

[ STATUS ]
Current Day: 8
Recovery sequence active.

[ BOARD ]
Day 01  ✓
Day 02  ✓
Day 03  ✓
Day 04  ✓
Day 05  ✓
Day 06  ✓
Day 07  ✓
Day 08  ●
Day 09  ·
Day 10  ·
...
Day 28  ·

[ PRIMARY ACTION ]
Continue Day 8

[ SECONDARY ACTION ]
Restart Journey

[ FOOTNOTE ]
Progress continues from your current path.
```

---

## 5. Journey Step Screen

```
[ HEADER ]
Journey / Day 8

[ TITLE ]
Restore internal alignment

[ BODY ]
Take one action that re-establishes your internal consistency today.

[ ACTION ]
Complete Day 8

[ SECONDARY ]
Back to Journey
```

---

## 6. Visibility Rules

- Journey is not shown on Arena first screen
- Journey is not a dashboard primary CTA
- `bounce_back_count` is not shown as XP or rank
- `bounce_back_count` is minimized or hidden by default
- Journey uses recovery framing, not competition framing

---

## 7. Restart Policy

- default = continue
- restart = optional manual action only
- restart is never automatic after inactivity
