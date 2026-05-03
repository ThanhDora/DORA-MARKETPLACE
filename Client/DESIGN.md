---
name: Apple Liquid Glass Marketplace
colors:
  primary: "#0B1220"
  secondary: "#5A6475"
  tertiary: "#007AFF"
  accent: "#64D2FF"
  success: "#30D158"
  warning: "#FF9F0A"
  danger: "#FF453A"
  surface: "rgba(255, 255, 255, 0.66)"
  surfaceStrong: "rgba(255, 255, 255, 0.82)"
  neutral: "#EEF3FA"
  border: "rgba(255, 255, 255, 0.58)"
  hairline: "rgba(255, 255, 255, 0.46)"
  darkSurface: "rgba(20, 24, 33, 0.58)"
typography:
  body:
    fontFamily: "SF Pro Display"
    fallback: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
  display:
    fontFamily: "SF Pro Display"
    weight: "700"
    tracking: "-0.055em"
  label:
    fontFamily: "SF Pro Text"
    weight: "700"
    tracking: "0.01em"
  sourceScale: "12/13/15/17/21/28/34/48/64/78"
rounded:
  sm: "14px"
  md: "22px"
  lg: "32px"
spacing:
  pageInline: "clamp(18px, 4vw, 64px)"
  sectionBlock: "clamp(56px, 7vw, 92px)"
  gridGap: "clamp(16px, 2vw, 24px)"
motion:
  fast: "180ms"
  medium: "360ms"
  spring: "cubic-bezier(0.19, 1, 0.22, 1)"
effects:
  glassBlur: "28px"
  glassSaturation: "1.8"
  glassShadow: "0 24px 70px rgba(31, 45, 71, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.72), inset 0 -1px 0 rgba(255, 255, 255, 0.24)"
  glassHoverShadow: "0 34px 90px rgba(31, 45, 71, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.86), inset 0 -1px 0 rgba(255, 255, 255, 0.28)"
---

## Overview

Apple Liquid Glass style for Dora MARKETPLACE: translucent layers, soft refraction, specular highlights, floating panels and springy interactions. The UI should feel like marketplace controls sit on frosted glass above an ambient iOS/macOS background.

## Style Foundations

- **Visual direction:** frosted liquid glass, bright depth, soft blue-cyan tint, subtle chromatic glow.
- **Surface behavior:** all major cards, popovers, navigation, checkout panels and product cards use translucent glass with blur and saturation.
- **Depth:** panels float with layered shadows, hairline borders and inset highlights instead of flat gray cards.
- **Motion:** hover lifts should feel springy and physical; loading/ambient effects should drift slowly.
- **Accessibility:** text stays high contrast; glass is decorative, not required for readability.

## Colors

- **Primary (#0B1220):** body text on light glass.
- **Secondary (#5A6475):** helper text and muted labels.
- **Tertiary (#007AFF):** Apple blue for primary actions.
- **Accent (#64D2FF):** cyan glow and refraction tint.
- **Neutral (#EEF3FA):** page base behind glass.
- **Surface (rgba(255,255,255,0.66)):** default glass panel fill.
- **Surface Strong (rgba(255,255,255,0.82)):** inputs and compact controls.
- **Border (rgba(255,255,255,0.58)):** glass edge.

## Liquid Glass Rules

- Use `backdrop-filter: blur(28px) saturate(1.8)` on all floating panels.
- Use a top-left white sheen and bottom-right cyan/blue tint to simulate refraction.
- Use inset highlights for the glass rim instead of heavy borders.
- Use larger radii: small controls `14px`, cards `22px`, hero/major panels `32px`.
- Keep dark mode glass darker but still translucent with blue/cyan rim light.

## Component Mapping

- **Header / mobile nav:** pinned glass bar with saturation and soft shadow.
- **Cards / dashboards / checkout:** liquid glass panel with specular overlay.
- **Buttons:** blue glass capsule, bright highlight on hover, small lift.
- **Inputs:** strong glass field with visible focus halo.
- **Product visuals:** glassy gradient placeholder with subtle internal glow.
- **Popovers / suggestions:** layered glass with high blur and strong edge.
