---
name: I learn arch btw
description: A monochrome command field for learning Arch Linux by doing.
colors:
  black: "#080808"
  white: "#ffffff"
  paper: "#f4f4f1"
  ink-muted: "rgba(8, 8, 8, 0.58)"
  line: "rgba(8, 8, 8, 0.18)"
  dark-line: "rgba(255, 255, 255, 0.24)"
typography:
  display:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace"
    fontSize: "clamp(3.2rem, 6.2vw, 6.6rem)"
    fontWeight: 600
    lineHeight: 0.92
    letterSpacing: "-0.09em"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.52
  label:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.15em"
rounded:
  none: "0px"
spacing:
  xs: "8px"
  sm: "13px"
  md: "24px"
  lg: "42px"
  xl: "86px"
components:
  button-primary:
    backgroundColor: "{colors.black}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "14px 15px 14px 17px"
  terminal-surface:
    backgroundColor: "{colors.black}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "26px"
---

# Design system: I learn arch btw

## Overview

**Creative North Star: "The command field"**

The interface behaves like a small black-and-white data instrument. It records a learner's current position, shows the command under study, and gives the learner a safe place to run it. The visual language comes from fixed-width terminal text, barcode columns, ruled paper, and an occasional hard inversion.

The page is dense where the learner needs to act and quiet where the learner needs to read. There are no decorative gradients, soft dashboard cards, or ornamental color accents. Progress is a register, navigation is a sequence of rows, and the practice shell is the largest dark surface on the page.

**Key Characteristics:**

- Monochrome black, white, and paper ground
- Hairline rules and square controls
- Monospace labels for command, state, and measurement
- A single scanning line as the authored motion

## Colors

Use black and white for product meaning. The paper ground and translucent rules provide separation without introducing a decorative hue.

### Primary

- **Instrument black** (#080808): Navigation, practice terminal, primary actions, and active data surfaces.
- **Signal white** (#ffffff): Inverted active navigation, terminal text, active controls, and completion states.

### Neutral

- **Paper** (#f4f4f1): The reading ground for lesson content.
- **Ink-muted** (rgba(8, 8, 8, 0.58)): Supporting copy and secondary labels.
- **Line** (rgba(8, 8, 8, 0.18)): Dividers, register rules, and structural grouping.

### Named Rules

**The inversion rule.** Use contrast shifts to show state. Do not add a new accent color to make an element feel active.

## Typography

**Display Font:** SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace
**Body Font:** Arial, Helvetica, sans-serif
**Label/Mono Font:** SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace

**Character:** The display face is measured, compact, and tied to command-line data. The body face stays plain and readable for explanations.

### Hierarchy

- **Display** (600, `clamp(3.2rem, 6.2vw, 6.6rem)`, `0.92`): First-viewport thesis and major lesson titles.
- **Headline** (500, `clamp(1.8rem, 3.6vw, 3.7rem)`, `0.98`): Section titles and reference headings.
- **Title** (500, `clamp(1.7rem, 3vw, 2.8rem)`, `0.98`): Quiz and terminal task titles.
- **Body** (400, `17px`, `1.52`): Explanatory copy, kept near a 65ch measure.
- **Label** (700, `10px`, `0.15em`, uppercase): Course state, navigation, and metadata.

### Named Rules

**The data voice rule.** Monospace is reserved for commands, measurements, navigation labels, and display headlines. Explanations stay in the body face.

## Layout

Desktop uses a 292px navigation rail beside a fluid content column. The content is capped at 1480px and padded by `clamp(24px, 4vw, 64px)`. The first viewport uses two columns, with the written thesis on the left and a live-looking command field on the right. Lesson content uses a wide reading column and a sticky knowledge check.

At 1100px the rail becomes a top strip with horizontally scrollable lesson rows. At 760px the hero stacks, the register becomes two columns, the lesson and knowledge check become one column, and reference entries become a two-column grid.

## Elevation & Depth

The system is flat at rest. Depth comes from black and white surfaces, borders, and document-like rules. The hero's terminal readout uses a restrained translucent offset shadow to separate it from the data field. Avoid ambient shadows on ordinary content.

## Shapes

All primary surfaces and controls use square corners. Borders are 1px or 2px structural rules. Small square markers may be used for lesson state, objective state, or icon containers. There are no pills or rounded cards.

## Components

### Buttons

- **Shape:** Square, `0px` radius.
- **Primary:** Black background, white text, monospace label, `14px 15px 14px 17px` padding.
- **Hover / Focus:** Invert to white background and black text. Focus uses a 2px black outline offset by 4px.
- **Secondary:** Use a transparent background with a structural border, not a pill.

### Cards / Containers

- **Corner Style:** `0px` radius.
- **Background:** Content sits on paper. The practice terminal and knowledge check use instrument black.
- **Shadow Strategy:** Flat by default. Use the small terminal readout offset only where it reinforces the data-field layer.
- **Border:** Hairline rules for grouping, 2px black rules for section starts.
- **Internal Padding:** 18px, 24px, or 26px depending on density.

### Inputs / Fields

- **Style:** Transparent black terminal input with no border, paired with a visible path label.
- **Focus:** Native input focus remains visible through the high-contrast outline.
- **Error / Disabled:** Use contrast and opacity. Never rely on color alone.

### Navigation

The lesson rail is a sequence of rows with numbered module labels. The active row inverts to white on black. Locked rows stay present but quiet. On narrow screens, the same rows become a horizontal sequence so the path remains available without taking the first viewport.

### Command field

The hero field uses fixed-width bars, vertical registration lines, a terminal readout, and one scanning rule. The practice terminal repeats the same black-and-white material at a larger, interactive scale.

## Do's and Don'ts

### Do:

- **Do** use structural rules to separate sections and states.
- **Do** keep command syntax, numbers, and status in the mono label voice.
- **Do** make the browser-only safety boundary visible near the practice input.
- **Do** use inversion for active, selected, and completed states.

### Don't:

- **Don't** bring back rounded dashboard cards, soft gradients, or decorative color.
- **Don't** use an eyebrow above a heading when the heading can carry the hierarchy.
- **Don't** use monospace for every paragraph or treat it as a generic tech costume.
- **Don't** let the data field replace the real command interaction below it.
