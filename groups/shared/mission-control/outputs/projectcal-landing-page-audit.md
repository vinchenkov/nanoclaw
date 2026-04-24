# ProjectCal Landing Page Conversion Funnel Audit

**Task ID:** I-046-AUDIT-PROJECTCAL-LANDING-PAGE-CONVERSION-FUNNEL
**Date:** 2026-03-15

---

## 1. Current Conversion Flow Documentation

### Flow Overview

```
Visitor Lands on /
       │
       ├─> [Explore Projects CTA] --> /map (public, no auth required)
       │                              │
       │                              └─> No conversion trigger to signup
       │
       ├─> [Sign Up button in nav] --> /signup
       │                              │
       │                              └─> Email + Password form (stricter requirements)
       │
       └─> [Sign In button in nav] --> /login
                                      │
                                      └─> Email + Password form

Pricing section links to /signup (for non-logged-in users)
```

### Page-by-Page Analysis

| Page | Purpose | Conversion Barriers |
|------|---------|---------------------|
| `/` (Landing) | Awareness, interest | Primary CTA bypasses signup, no trust signals |
| `/map` | Product demo | No paywall = no motivation to convert |
| `/signup` | Account creation | Strict password requirements, no value reinforcement |
| `/login` | Existing user entry | No incentive for returning visitors to upgrade |

---

## 2. Identified Issues (Severity Rated)

### Issue #1: Primary CTA Bypasses Conversion (SEVERITY: HIGH)

**Location:** `app/page.tsx` lines 33-39

**Problem:** The hero section's "Explore Projects" button links directly to `/map`, a publicly accessible page. Users can explore the product's core value (viewing CEQA projects) without creating an account. This eliminates the primary conversion trigger.

**Evidence:**
```tsx
<a href="/map" className="...">Explore Projects</a>
```

**Impact:** High drop-off before any conversion attempt. Visitors get value for free, with no reason to sign up.

---

### Issue #2: No Trust Signals (SEVERITY: HIGH)

**Location:** `app/page.tsx` (entire landing page)

**Problem:** Zero testimonials, customer logos, case studies, or social proof. A visitor landing on the page has no evidence that the product delivers value.

**Missing elements:**
- No customer quotes or success stories
- No company logos using the product
- No usage statistics (e.g., "500+ contractors rely on ProjectCal")
- No press mentions or certifications

**Impact:** Reduced trust, especially for B2B buyers who need peer validation.

---

### Issue #3: Strict Password Requirements Cause Friction (SEVERITY: MEDIUM)

**Location:** `components/signup-form.tsx` lines 29-39

**Problem:** Signup requires password matching: `(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[@$!%*#?~(&)+=^_-])` — must contain uppercase, lowercase, digit, and symbol. This is more demanding than industry standards (typically 8+ characters).

**Evidence:**
```tsx
password: z
  .string()
  .min(6, 'Password must contain at least 6 characters')
  .regex(re, 'Password must contain Lowercase, uppercase letters, digits and symbols')
```

**Impact:** Higher form abandonment rate. Users may retry multiple times or leave.

---

### Issue #4: Typo in Value Proposition (SEVERITY: LOW)

**Location:** `app/page.tsx` line 172

**Problem:** "Sacremento" should be "Sacramento"

```tsx
"Track all new tract map filings / land subdivisions in Sacremento"
```

**Impact:** Minor credibility reduction for detail-oriented visitors.

---

### Issue #5: No Free Tier or Trial (SEVERITY: HIGH)

**Location:** `components/pricing.tsx`

**Problem:** No option to try the product before paying. The pricing section offers only a $69/month subscription with no freemium, no trial, no limited-feature access.

**Evidence:**
```tsx
<h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
  Monthly Subscription
</h3>
<p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
  Includes full access to our project data and discovery tools.
</p>
```

**Impact:** High barrier to entry. Many SaaS conversions rely on letting users experience value first.

---

### Issue #6: No FAQ or Objection Handling (SEVERITY: MEDIUM)

**Location:** `app/page.tsx`

**Problem:** No section addressing common concerns:
- "Is this data authoritative/official?"
- "How often is data updated?"
- "What counties/regions are covered?"
- "Can I cancel anytime?" (only mentioned in pricing footer)

**Impact:** Unanswered questions = hesitation = lost conversions.

---

### Issue #7: Minimal Signup Form UX (SEVERITY: MEDIUM)

**Location:** `components/signup-form.tsx`

**Problem:** Signup form provides no context on:
- Why the user should sign up
- What they get immediately after signup
- How long the process takes

The form is a bare card with email/password fields only.

**Evidence:**
```tsx
<CardTitle className="text-2xl font-bold">Signup</CardTitle>
<CardDescription>Please enter your email and password</CardDescription>
```

**Impact:** No motivation reinforcement at the point of conversion.

---

### Issue #8: Map Page Has No Paywall (SEVERITY: HIGH)

**Location:** `app/map/page.tsx` line 71

**Problem:** The map page uses `useAuth` hook but allows unauthenticated access. Users can see and interact with project pins without signing up. The onboarding prompt may prompt for signup, but there's no hard gate.

**Evidence:**
```tsx
const { user, isAuthenticated, isSubscribed } = useAuth(supabase);
```

**Impact:** The product's core value (project discovery) is available without conversion.

---

## 3. Top 3 Recommended Fixes

### Fix #1: Gate Map Access or Add Conversion Trigger (Expected Impact: HIGH)

**Option A - Soft Gate:** After 3 map interactions (clicks, searches), show a modal: "Create free account to save your searches and get daily Radar alerts."

**Option B - Hard Gate:** Make map read-only for anonymous users (limited pins, no details), full access for signed-up users.

**Implementation files:**
- `app/map/page.tsx` - add auth check before loading full data
- Add new component: `components/conversion-prompt.tsx`

**Expected impact:** 20-40% conversion rate improvement (from visitors who engage with product).

---

### Fix #2: Add Trust Signals Section (Expected Impact: HIGH)

Add a "Trusted by" section between Hero and Features sections:

```tsx
<section className="py-12 text-center">
  <p className="text-sm text-gray-400 mb-6 uppercase tracking-wider">
    Trusted by contractors and developers across California
  </p>
  {/* Company logos grid */}
  <div className="flex justify-center gap-8 grayscale opacity-60">
    {/* Placeholder logos */}
  </div>
</section>
```

Also add one testimonial card in the Features section.

**Implementation files:**
- `app/page.tsx` - add after hero section (around line 57)
- Consider adding a `components/testimonials.tsx`

**Expected impact:** 10-20% trust improvement, higher consideration rate.

---

### Fix #3: Add Free Tier or Trial (Expected Impact: HIGH)

Option A: Free tier with limited daily searches (e.g., 5 projects/day)
Option B: 14-day free trial with full access

**Implementation files:**
- `components/pricing.tsx` - add tier options
- `app/api/auth/...` - adjust signup flow for trial logic
- Add feature flag in `lib/configs/`

**Expected impact:** 30-50% increase in signups (lower barrier to entry).

---

## 4. File References for Code Changes

| File | Changes Needed |
|------|----------------|
| `app/page.tsx` | Add trust signals section, fix typo (line 172), improve CTA messaging |
| `app/map/page.tsx` | Add auth gating or conversion trigger after N interactions |
| `components/signup-form.tsx` | Add benefit copy, consider relaxing password requirements |
| `components/pricing.tsx` | Add free tier or trial option, expand feature list |
| New: `components/testimonials.tsx` | Create reusable trust component |

---

## Summary

The ProjectCal landing page has a clear structural issue: the primary CTA ("Explore Projects") sends visitors to a public, fully-featured map where they can experience the product's core value without signing up. Combined with the absence of trust signals, strict signup friction, and no free trial, the conversion funnel has significant leaks.

**Priority fixes:**
1. Gate map access or add conversion trigger (highest ROI)
2. Add trust signals (testimonials, logos)
3. Introduce free tier or trial

These changes can be implemented iteratively and tested with A/B metrics.