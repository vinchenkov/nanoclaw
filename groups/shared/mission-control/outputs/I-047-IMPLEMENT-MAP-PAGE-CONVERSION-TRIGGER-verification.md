# ProjectCal Map Page Conversion Trigger - Implementation

## Task ID
I-047-IMPLEMENT-MAP-PAGE-CONVERSION-TRIGGER

## Overview
Implemented a conversion trigger on the ProjectCal map page that shows a signup modal after 3 map interactions (clicks, searches) for unauthenticated users.

## Changes Made

### 1. New Component: `components/conversion-prompt.tsx`
Created a new modal component that:
- Uses Radix UI Dialog (consistent with existing UI patterns)
- Displays value proposition for signing up:
  - Save searches and run them anytime
  - Get daily Radar alerts for new projects
  - Access project details and contact information
- Provides "Create free account" CTA button
- Includes "Maybe later" dismiss option
- Uses consistent styling with existing onboarding prompts (green accent color, dark theme)

### 2. Modified: `app/map/page.tsx`

#### State Additions
- `interactionCountRef`: Tracks number of interactions using a ref (avoids re-renders)
- `isConversionPromptOpen`: Controls modal visibility
- `conversionPromptDismissed`: Tracks if user has dismissed the prompt (to not show again)

#### New Functions
- `trackInteraction()`: Increments counter and shows modal after 3 interactions
- `handleCloseConversionPrompt()`: Closes modal and marks as dismissed
- `handleSignUpFromConversionPrompt()`: Closes modal, dismisses, and triggers signup flow
- Added `trackInteractionRef` to allow calling from useEffect closures

#### Interaction Tracking Points
1. **Map Pin Clicks**: Added in `handlePinClick` inside the map useEffect
2. **Smart Search Panel Open**: Added in `handleOpenSmartSearch` callback
3. **Radar Panel Open**: Added in `handleOpenRadar` callback
4. **DeepRadar Panel Open**: Added in `handleOpenDeepRadar` callback

#### Render Addition
Added `<ConversionPrompt />` component after `<OnboardingPrompt />`

### Conditions for Showing Modal
- User is NOT authenticated (`!isAuthenticated`)
- User has NOT dismissed the prompt before (`!conversionPromptPromptDismissed`)
- User has performed 3 or more interactions

## Files Changed
1. `/workspace/extra/dirtsignals/components/conversion-prompt.tsx` (new)
2. `/workspace/extra/dirtsignals/app/map/page.tsx` (modified)

## Verification

### Lint Check
```bash
npm run lint
```
Result: Passes with no errors

### Code Review Checklist
- [x] Component imports correctly
- [x] State management uses ref for performance (avoids re-renders on each click)
- [x] Modal only shows for unauthenticated users
- [x] Modal doesn't show again after dismissal
- [x] Sign up button triggers onboarding/signup flow
- [x] Consistent styling with existing components
- [x] No ESLint errors

## Usage Notes
- Interactions are tracked via ref to avoid unnecessary re-renders
- The modal will not interfere with the onboarding flow (separate prompt)
- Users can dismiss with "Maybe later" or proceed to signup
- The tracking survives page navigation within the map session (ref-based)
