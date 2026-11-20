/**
 * Docky Installation Assistant: offline knowledge base
 * American Muscle Docks & Fabrication, Mr. Kayak Launch Dock (Mr. Launcher 2.0)
 *
 * Page numbers are the PRINTED page numbers from the 9.16.26 manual (the number in each page footer).
 * pageId values are the website section anchors.
 * Every answer below was checked against the 9.16.26 PowerPoint.
 * The live AI system prompt is server-side only: netlify/functions/lib/docky-system-prompt.mjs
 */

const DOCKLY_KB = {
  // The kayak manual has no numbered item key, so parts are listed by name and quantity.
  parts: [
    { qty: 2, name: '2’ x 8’ Floating Platforms' },
    { qty: 1, name: 'Aluminum Grab-Bar' },
    { qty: 2, name: 'Aluminum Pipe Supports, 1.5” pipe, 7’ long' },
    { qty: 2, name: 'Aluminum Sq. Tube Stabilizers, rubber V-rollers and bolts installed' },
    { qty: 8, name: 'Pipe Supports: 3/8 x 4” stainless bolts & grease' },
    { qty: 4, name: 'Sq. Tube Stabilizers: 3/8 x 3” stainless bolts' },
    { qty: 2, name: 'Grab-Bar: 3/8 x 5” all-thread bolts' },
    { qty: 2, name: 'Grab-Bar: 3/8 x 1.5” all-thread bolts' },
    { qty: 2, name: 'K.K. Pipe Receiver: 3/8 x 1 ¼” carriage bolts' },
    { qty: 4, name: 'K.K. Pipe Receiver: 3/8 x 4” carriage bolts' },
    { qty: 8, name: 'K.K. Deck Bracket: 1/2 x 3” carriage bolts' }
  ],
  // printed: the number shown in the manual footer (null = unnumbered)
  pages: [
    { printed: null, id: 'page-1', title: 'Cover' },
    { printed: 2, id: 'page-2', title: 'Start Here' },
    { printed: 3, id: 'page-3', title: 'What’s Inside, Kit Contents & Bolt Bags' },
    { printed: 4, id: 'page-4', title: 'Four Step Installation & Tools Needed' },
    { printed: 5, id: 'page-5', title: 'Step One, Attach The Aluminum Pipe Supports' },
    { printed: 6, id: 'page-6', title: 'Step Two, Attach The Sq. Tube Stabilizers' },
    { printed: 7, id: 'page-7', title: 'Step Three, Install The Aluminum Grab-Bar' },
    { printed: 8, id: 'page-8', title: 'Step Four, Mount The Kandy Kane Pipe Receivers & Brackets' },
    { printed: 9, id: 'page-9', title: 'Gallery & Dimension Drawings' },
    { printed: null, id: 'page-10', title: 'Questions Before Install?' }
  ]
};

// Offline answers used when the AI relay is not configured or unavailable.
const OFFLINE_DIAGNOSTICS = [
  {
    keywords: ['pipe support', 'pipe supports', 'step 1', 'step one', 'v bracket', 'v brackets', 'the v', 'grease', 'stainless', '3 feet apart', '3’ apart', 'nut on top', 'platforms apart'],
    title: 'Step One, Aluminum Pipe Supports',
    response: `From **Page 5**:

1. **Spacing**: Place both floating platforms roughly **3’ apart** from each other. *Make sure you put the sides with the **pre-drilled holes in the center** for the grab-bar facing each other.*
2. **Lay the supports**: Lay the aluminum pipe supports inside (on top) of the **“V’s”** on the floating platforms and attach them with the **3/8 x 4” stainless steel bolts**. **Be sure to use the included grease on the threads.**
3. **Bolt direction**: Bolts go in from the **bottom of the V**, up through the V and the aluminum pipe, with the **nut on top**.
4. **Loose for now**: Loosely tighten all **(8)** bolts through the pre-drilled holes in the pipe supports and the aluminum platform frame. Finish **(step 3)** before tightening all the way.`,
    actionLink: { text: 'Open Page 5: Attach The Aluminum Pipe Supports', pageId: 'page-5' }
  },
  {
    keywords: ['stabilizer', 'stabilizers', 'sq. tube', 'square tube', 'v-roller', 'v roller', 'roller', 'rollers', 'step 2', 'step two', 'finger tighten', 'kayak bottom', 'resistance', 'floating away', 'new holes'],
    title: 'Step Two, Sq. Tube Stabilizers',
    response: `From **Page 6**:

1. **Mount**: Mount the square tube stabilizers with the rubber V-roller to each **inside end** between the two dock sections with **(4) 3/8 x 3” bolts**.
2. **Finger tight**: Put both pieces in and **finger tighten** until you are done with **(step 3)**.

**\\*\\* Pre-drilled holes are already in the aluminum V** where most kayaks sit best on the rubber rollers. Some kayak bottoms are made differently and may require new holes drilled to move this bracket either up or down.

The correct resistance should be enough to let you get in and out of your kayak without the kayak wanting to move too much. The holes are set to the most common height suitable for most kayak bottoms, so the rollers hold your kayak without it floating away when docked.`,
    actionLink: { text: 'Open Page 6: Attach The Sq. Tube Stabilizers', pageId: 'page-6' },
    clarification: 'Is your kayak sitting too loose on the rollers, or too tight to get in and out?'
  },
  {
    keywords: ['grab-bar', 'grab bar', 'grabbar', 'step 3', 'step three', 'all-thread', 'all thread', 'sleeper board', 'center', 'holes do not line up', 'holes don’t line up', 'tighten all bolts'],
    title: 'Step Three, Aluminum Grab-Bar',
    response: `From **Page 7**:

1. **Placement**: Place the aluminum grab-bar in the **very center** of the inside of the two floating platforms. There are pre-drilled holes on the top and bottom of the grab-bar; match these to the pre-drilled holes in the platforms.
2. **If the holes do not line up exactly**, you may have to loosen some of the bolts for the aluminum pipe supports or square tube stabilizers you already installed.

**Fasten the bolts:**
- Attach **(1) 3/8 x 5” all-thread bolt** per bracket **from the top**, going down through the grab-bar, center sleeper board, and decking.
- Attach **(1) 3/8 x 1.5” all-thread bolt** per bracket **from the sides**, through the grab-bar and frame.
- After the grab-bar is installed, **tighten all bolts from (steps 1-3)**.`,
    actionLink: { text: 'Open Page 7: Install The Aluminum Grab-Bar', pageId: 'page-7' }
  },
  {
    keywords: ['kandy kane', 'kandy', 'kane', 'pipe receiver', 'receiver', 'receivers', 'deck bracket', 'deck brackets', 'step 4', 'step four', 'carriage bolt', 'carriage bolts', '2x4', 'sleeper', 'flange', 'gap', 'permanent structure'],
    title: 'Step Four, Kandy Kane Receivers & Brackets',
    response: `From **Page 8**:

**Mounting the pipe receivers** onto your floating dock section: straddle the outside **2x4” sleeper board** so that board fills the void between the decking and the aluminum frame, or use a **2x4” block** to fill the void under the bracket.

**PIPE RECEIVERS**
- Use **(2) 3/8 x 4” carriage bolts** per mount, from the top down.
- \\* Drill these holes on a **slight angle towards the outside of the dock**. Don’t worry if you hit the float mounting flange.
- Use **(1) 3/8 x 1 ¼” carriage bolt** on the side face per mount.

**DECK BRACKETS**
- Lay out where you want to drill, then attach the Kandy Kane deck brackets to your other **permanent structure**, each with **(4) 1/2 x 3” carriage bolts**.
- Mount the plate **as far out to the edge of the decking as possible** so there is a gap between the pipe and your decking. That gap is what lets the pipe holders on the kayak launch move up the pipe without getting stuck between your dock.`,
    actionLink: { text: 'Open Page 8: Mount The Kandy Kane Pipe Receivers & Brackets', pageId: 'page-8' },
    clarification: 'Are you mounting the deck brackets to a fixed dock, a seawall, or another permanent structure?'
  },
  {
    keywords: ['tool', 'tools', 'wrench', 'drill bit', 'drill size', 'cordless', 'helper', '9/16', '7/16'],
    title: 'Tools Needed',
    response: `Tools list from **Page 4**:

- **9/16” wrench**
- **7/16” drill bit**
- **Cordless drill**
- **A helper to move the platforms**

**Good to know (also Page 4):**
- Work on a flat surface & shallow water when installing
- Leave bolts loose until the end of **(step 3)**
- Remove from dock for any inclement storms
- Read all directions before assembly`,
    actionLink: { text: 'Open Page 4: Four Step Installation & Tools Needed', pageId: 'page-4' }
  },
  {
    keywords: ['contents', 'kit', 'bolt bag', 'bolt bags', 'parts', 'inventory', 'missing', 'what’s inside', 'whats inside', 'how many bolts', 'quantity', 'hardware'],
    title: 'Kit Contents & Bolt Bags',
    response: `From **Page 3**:

**KIT CONTENTS**
- 2’ x 8’ Floating Platforms — **2**
- Aluminum Grab-Bar — **1**
- Aluminum Pipe Supports, 1.5” pipe, 7’ L — **2**
- Aluminum Sq. Tube Stabilizers, rubber V-rollers and bolts installed — **2**

**BOLT BAGS**
- Pipe Supports, 3/8 x 4” stainless bolts & grease — **8**
- Sq. Tube Stabilizers, 3/8 x 3” stainless bolts — **4**
- Grab-Bar, 3/8 x 5” all-thread bolts — **2**
- Grab-Bar, 3/8 x 1.5” all-thread bolts — **2**
- K.K. Pipe Receiver, 3/8 x 1 ¼” carriage bolts — **2**
- K.K. Pipe Receiver, 3/8 x 4” carriage bolts — **4**
- K.K. Deck Bracket, 1/2 x 3” carriage bolts — **8**

*Grease the 3/8 x 4” stainless bolt threads when installing the pipe supports.*

Anything missing, call AMD at **1-800-223-3444**.`,
    actionLink: { text: 'Open Page 3: What’s Inside', pageId: 'page-3' }
  },
  {
    keywords: ['intended use', 'one person', 'safety', 'safe', 'floating dock', 'storm', 'storms', 'weather', 'capacity', 'how many people', 'stand on'],
    title: 'Intended Use & Safety',
    response: `From **Page 2**:

- **INTENDED USE, ONE PERSON AT A TIME.**
- This residential launch is intended to be an accessible way to enter and exit your kayak more easily.
- This residential kayak launch **is not intended to be a floating dock** and should be used by **one person at a time**.
- Follow the directions for proper & safe installation.

From **Page 4**: **Remove from dock for any inclement storms.**

Read all directions and watch the help videos before you begin: [youtube.com/@amdocks](https://youtube.com/@amdocks)`,
    actionLink: { text: 'Open Page 2: Start Here', pageId: 'page-2' }
  },
  {
    keywords: ['dimension', 'dimensions', 'size', 'how wide', 'how long', 'how tall', 'measurement', 'measurements', '84', '96', '27', '11', '38 1/2', 'spec', 'specs'],
    title: 'Dimensions',
    response: `From the dimension drawings on **Page 9**:

- **Overall width**: **84 1/4”**, made up of **24 1/2” + 35 1/4” + 24 1/2”**
- **Platform length**: **96”**
- **Grab-bar height**: **27”**
- **Deck height**: **11”**
- **Stabilizer**: **1” tubing**, **38 1/2”** long. Hole spacing **1”, 12”, 12 1/2”, 12”, 1”**, with **7/16” holes typical**
- **Pipe support**: adjustable, with a **7/16” hole**

Tap the dimension drawing on Page 9 to open it full screen, then use Full Size (100%) to read every callout.`,
    actionLink: { text: 'Open Page 9: Gallery & Dimension Drawings', pageId: 'page-9' }
  },
  {
    keywords: ['video', 'videos', 'help', 'support', 'call', 'phone', '1-800', 'contact', 'website', 'youtube'],
    title: 'Help & Support',
    response: `- **American Muscle Docks**: **1-800-223-3444**
- **Website**: [americanmuscledocks.com](https://americanmuscledocks.com)
- **Help videos**: [youtube.com/@amdocks](https://youtube.com/@amdocks)
- **Installation resources**: [americanmuscledocks.com/blogs/instructions](https://americanmuscledocks.com/blogs/instructions)

Please refer to our website for videos, and read all directions prior to assembly.`,
    actionLink: { text: 'Open Page 10: Questions Before Install?', pageId: 'page-10' }
  }
];

const DOCKY_KB = DOCKLY_KB;
const DOCKY_DIAGNOSTICS = OFFLINE_DIAGNOSTICS;
