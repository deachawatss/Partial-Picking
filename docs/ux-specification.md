# Partial-Picking UX/UI Specification

_Generated on 2025-10-08 by Wind_

## Executive Summary

The **Partial Picking System PWA** is a production-ready warehouse picking application designed to replace an existing desktop system with a modern, real-time, offline-capable Progressive Web Application. The system serves **TFC1 warehouse operators** with **flexible deployment** to any Windows PC via a .NET Bridge Config Wizard (initial deployment: WS1-WS4, expandable to 8+ workstations).

**Deployment Architecture:**
- **Hardware-Agnostic Workstations**: Any Windows PC with 1280×1024 display and supported weight scales
- **Config Wizard Setup**: .NET 8 Bridge Service installer binds workstation to SMALL/BIG scales automatically
- **Scalability**: No hardcoded workstation limits—add new stations by running config wizard on any PC

**Key UX Challenges Addressed:**
1. **Flexible Lot Selection** with 3 input methods:
   - **Search**: Click 🔍 icon → Lot search modal with autocomplete
   - **Scan**: Barcode scanner auto-fills lot field
   - **Manual**: Direct keyboard entry

2. **Intelligent Bin Auto-Selection** with Manual Override:
   - **Auto-FEFO**: System selects earliest expiry bin automatically
   - **User Control**: Click Bin No → Opens bin selector modal for manual override
   - **Transparency**: Shows selection reason ("Auto: FEFO" vs "Manual: Operator override")

3. **Real-Time Weight Monitoring** with visual tolerance indicators:
   - Green: Weight valid + stable → Enable "Add Lot"
   - Yellow: Valid but unstable → Wait for stabilization
   - Red: Out of tolerance → Show exact deficit/excess

4. **Zero-Install PWA Deployment**:
   - Update all workstations instantly (no manual installation)
   - Offline capability for uninterrupted operation

**Business Impact:**
- **20% time savings**: 30 min → 24 min per batch (automated FEFO + flexible lot search)
- **100% FEFO compliance**: Auto-selection with audit trail for manual overrides
- **99.5% uptime**: PWA offline capability vs 97% current desktop app

**Technical Foundation:**
- React 19 with concurrent rendering for non-blocking scale updates
- Dual WebSocket streams (SMALL/BIG scales, <200ms latency)
- Rust Axum backend with 4-phase atomic transactions
- SQL Server composite keys (no surrogate IDs)

**UX Priorities:**
1. **Speed**: ~100 picks/shift; every interaction optimized
2. **Flexibility**: Support search, scan, or manual workflows
3. **Control**: Auto-suggestions with manual override capability
4. **Clarity**: Instant visual feedback for all operations

---

## 1. UX Goals and Principles

### 1.1 Target User Personas

{{user_personas}}

### 1.2 Usability Goals

{{usability_goals}}

### 1.3 Design Principles

{{design_principles}}

---

## 2. Information Architecture

### 2.1 Site Map

{{site_map}}

### 2.2 Navigation Structure

{{navigation_structure}}

---

## 3. User Flows

{{user_flow_1}}

{{user_flow_2}}

{{user_flow_3}}

{{user_flow_4}}

{{user_flow_5}}

---

## 4. Component Library and Design System

### 4.1 Design System Approach

{{design_system_approach}}

### 4.2 Core Components

{{core_components}}

---

## 5. Visual Design Foundation

### 5.1 Color Palette

{{color_palette}}

### 5.2 Typography

**Font Families:**
{{font_families}}

**Type Scale:**
{{type_scale}}

### 5.3 Spacing and Layout

{{spacing_layout}}

---

## 6. Responsive Design

### 6.1 Breakpoints

{{breakpoints}}

### 6.2 Adaptation Patterns

{{adaptation_patterns}}

---

## 7. Accessibility

### 7.1 Compliance Target

{{compliance_target}}

### 7.2 Key Requirements

{{accessibility_requirements}}

---

## 8. Interaction and Motion

### 8.1 Motion Principles

{{motion_principles}}

### 8.2 Key Animations

{{key_animations}}

---

## 9. Design Files and Wireframes

### 9.1 Design Files

{{design_files}}

### 9.2 Key Screen Layouts

{{screen_layout_1}}

{{screen_layout_2}}

{{screen_layout_3}}

---

## 10. Next Steps

### 10.1 Immediate Actions

{{immediate_actions}}

### 10.2 Design Handoff Checklist

{{design_handoff_checklist}}

---

## Appendix

### Related Documents

- PRD: `/home/deachawat/dev/projects/BPP/Partial-Picking/docs/prd.md`
- Architecture: `/home/deachawat/dev/projects/BPP/Partial-Picking/docs/ARCHITECTURE.md`

### Version History

| Date     | Version | Changes               | Author        |
| -------- | ------- | --------------------- | ------------- |
| 2025-10-08 | 1.0     | Initial specification | Wind |
