Let me address both requests in sequence.

---

# REMAINING CYBERSECURITY Q&A (Q591–Q640 were already provided)

The cybersecurity questions were complete — Q1 through Q640 were fully delivered across both responses. Q336–Q500 were the gap that was filled in the follow-up. The full set is complete.

---

# FRONTEND DEVELOPMENT INTERVIEW QUESTIONS — 640 Q&A
## End-to-End: Basics to Advanced

---

# PART 1: TOPIC-WISE QUESTIONS (Q1–Q500)

---

## TOPIC 1: HTML FUNDAMENTALS

### Concept MCQ

Q1. What does HTML stand for?
A) Hyper Text Markup Language B) High Transfer Markup Language C) Hyper Transfer Machine Language D) Hyper Text Machine Language
Answer: A — HTML is the standard markup language for creating web pages.

Q2. What is the correct HTML5 doctype declaration?
A) `<!DOCTYPE HTML5>` B) `<!DOCTYPE html>` C) `<html doctype>` D) `<!HTML>`
Answer: B — `<!DOCTYPE html>` tells the browser to render in standards mode.

Q3. What is the difference between block-level and inline elements?
A) No difference B) Block elements start on a new line and take full width; inline elements flow within content and only take necessary width C) Inline elements are larger D) Block elements are for text only
Answer: B — div, p, h1-h6 are block. span, a, strong, em are inline.

Q4. What is the purpose of the `<meta charset="UTF-8">` tag?
A) Sets the page title B) Declares the character encoding so the browser correctly renders text including special characters C) Links a stylesheet D) Sets the viewport
Answer: B — UTF-8 supports virtually all characters in all languages.

Q5. What is the `alt` attribute on an image used for?
A) Alternative styling B) Providing text description for screen readers, SEO, and display when the image fails to load C) An image title D) Image dimensions
Answer: B — Alt text is critical for accessibility and is required for valid HTML.

Q6. What is semantic HTML?
A) HTML with JavaScript B) Using HTML elements that carry meaning about the content they contain, improving accessibility and SEO C) HTML with CSS D) HTML comments
Answer: B — Examples: `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<footer>`, `<aside>`.

Q7. What is the difference between `<strong>` and `<b>`?
A) No difference B) `<strong>` indicates semantic importance; `<b>` is purely presentational bold without semantic meaning C) `<b>` is deprecated D) `<strong>` is for titles
Answer: B — Use `<strong>` when the content is important; use `<b>` purely for visual styling.

Q8. What is the difference between `<em>` and `<i>`?
A) No difference B) `<em>` indicates stressed emphasis with semantic meaning; `<i>` is purely presentational italic C) `<i>` is deprecated D) `<em>` is for titles
Answer: B — Same pattern as strong vs b — semantic vs presentational.

Q9. What does the `data-*` attribute do?
A) Links to a database B) Stores custom data on HTML elements accessible via JavaScript, without using non-standard attributes C) Adds metadata D) Links data files
Answer: B — `data-user-id="123"` accessed via `element.dataset.userId`.

Q10. What is the difference between `<script>` placed in `<head>` vs end of `<body>`?
A) No difference B) In head it blocks HTML parsing; at end of body it loads after the page content, improving perceived performance C) Head is always better D) Body placement breaks CSS
Answer: B — Or use `defer`/`async` attributes to control loading behavior.

Q11. What is the `defer` attribute on a script tag?
A) Delays the script forever B) Downloads the script in parallel with HTML parsing but executes it after the document is fully parsed C) Executes immediately D) Same as async
Answer: B — `defer` maintains script execution order. `async` does not.

Q12. What is the `async` attribute on a script tag?
A) Makes script synchronous B) Downloads and executes the script asynchronously, without blocking HTML parsing or waiting for other scripts C) Delays execution D) Same as defer
Answer: B — Use `async` for independent scripts like analytics where order does not matter.

Q13. What is ARIA in HTML?
A) An HTML element B) Accessible Rich Internet Applications — attributes adding semantic information for assistive technologies like screen readers C) A CSS framework D) A JavaScript API
Answer: B — Examples: `role`, `aria-label`, `aria-hidden`, `aria-expanded`.

Q14. What is the `<picture>` element used for?
A) Displaying photos only B) Art direction and responsive images — specifying multiple image sources for different screen sizes, resolutions, or formats C) An image gallery D) Background images
Answer: B — `<picture>` with `<source>` elements and media queries provides responsive image loading.

Q15. What is the `srcset` attribute on `<img>`?
A) Multiple image sources B) Specifying multiple image files for different screen densities or viewport widths, letting the browser select the most appropriate one C) Image fallback D) Image dimensions
Answer: B — `srcset="img-400.jpg 400w, img-800.jpg 800w"` with `sizes` attribute.

### Fill in the Blank

Q16. The ________ element represents the main content area of a document and should appear only once per page.
Answer: `<main>`

Q17. The ________ attribute specifies that a form field must be filled before form submission.
Answer: required

Q18. The ________ HTML element creates a hyperlink to web pages, files, email addresses, or any URL.
Answer: `<a>` (anchor)

Q19. The ________ element is used to group table header cells, providing semantic meaning and default bold centered styling.
Answer: `<th>`

Q20. HTML ________ are metadata elements in the `<head>` providing information about the document to browsers and search engines.
Answer: meta tags

Q21. The ________ attribute on a form input creates a label-like placeholder text inside the input that disappears when typing begins.
Answer: placeholder

Q22. The ________ element represents a self-contained piece of content that could be distributed independently, like an article, blog post, or forum post.
Answer: `<article>`

Q23. The ________ element defines a section in a document that is tangentially related to the surrounding content, like a sidebar.
Answer: `<aside>`

Q24. The ________ attribute on an anchor tag opens the linked document in a new tab.
Answer: `target="_blank"`

Q25. The ________ element represents a thematic group of content, typically with a heading.
Answer: `<section>`

### Scenario

Q26. You need to build a navigation menu that is accessible to screen reader users. What HTML structure do you use?
Answer: Use a `<nav>` element wrapping an unordered list. Add `aria-label="Main navigation"` on the nav element to distinguish it from other nav elements. Use `<a>` tags for all links. For the current page link, add `aria-current="page"`. For dropdown menus, use `aria-expanded`, `aria-haspopup`, and manage focus with JavaScript. For mobile hamburger menus, add `aria-controls` linking the button to the menu it controls, and toggle `aria-expanded` on button click. Ensure all interactive elements are keyboard-navigable (tab order) and visible focus indicators are present. Use `role="menubar"` and `role="menuitem"` for complex multi-level menus per the ARIA authoring practices guide.

Q27. A designer gives you a form with 15 fields. How do you structure the HTML for maximum usability and accessibility?
Answer: Group related fields using `<fieldset>` and `<legend>`. Associate every label with its input using `<label for="inputId">` or wrapping. Use appropriate input types (email, tel, number, date) for mobile keyboard optimization and native validation. Add `required` to mandatory fields. Use `aria-describedby` to link error messages and hints to their fields. Use `autocomplete` attributes (name, email, street-address) for autofill support. Add `aria-invalid="true"` and descriptive error messages on validation failure. Group submit and reset buttons at the bottom. Use `<progress>` indicators for multi-step forms. Ensure tab order follows visual reading order.

---

## TOPIC 2: CSS FUNDAMENTALS

### Concept MCQ

Q28. What is the CSS box model?
A) A 3D model B) The model describing how elements are rendered with content, padding, border, and margin layers C) A CSS framework D) A layout model
Answer: B — Understanding the box model is fundamental to CSS layout.

Q29. What is the difference between `box-sizing: content-box` and `box-sizing: border-box`?
A) No difference B) content-box: width/height applies to content only; border-box: width/height includes padding and border — making sizing much more predictable C) border-box adds margin D) content-box includes padding
Answer: B — Most developers apply `* { box-sizing: border-box }` globally.

Q30. What is CSS specificity?
A) How specific CSS selectors are B) A weight system determining which CSS rule applies when multiple rules target the same element — inline > ID > class > element C) CSS priority D) CSS inheritance
Answer: B — Specificity is calculated as (inline, ID, class/pseudo-class/attribute, element/pseudo-element).

Q31. What is the CSS cascade?
A) A waterfall effect B) The algorithm determining which CSS declaration applies when multiple declarations target the same property — considering origin, importance, specificity, and source order C) CSS animation D) CSS inheritance
Answer: B — The cascade is one of the fundamental concepts of CSS.

Q32. What is CSS inheritance?
A) Child elements copying parent styling B) Some CSS properties automatically passed from parent to child elements (font-family, color) while others are not (margin, padding, border) C) CSS specificity D) Cascading rules
Answer: B — Use `inherit`, `initial`, `unset` keywords to explicitly control inheritance.

Q33. What is the difference between `display: none` and `visibility: hidden`?
A) No difference B) `display: none` removes the element from layout entirely; `visibility: hidden` hides it visually but it still takes up space C) Both remove from layout D) visibility is deprecated
Answer: B — `opacity: 0` makes it invisible but still interactive; `visibility: hidden` makes it invisible and non-interactive.

Q34. What is a CSS pseudo-class?
A) A fake class B) A keyword added to a selector applying styles to elements in a specific state — :hover, :focus, :nth-child(), :not() C) A class attribute D) A CSS variable
Answer: B — Pseudo-classes select elements based on their state or position.

Q35. What is a CSS pseudo-element?
A) A fake element B) A keyword creating a virtual element that does not exist in the DOM — ::before, ::after, ::first-line, ::first-letter, ::placeholder C) A pseudo-class D) An HTML element
Answer: B — `::before` and `::after` require a `content` property to render.

Q36. What is the difference between `em` and `rem` units?
A) No difference B) `em` is relative to the font-size of the current element; `rem` is relative to the root element's font-size (html element) — rem is more predictable C) em is absolute D) rem is deprecated
Answer: B — rem avoids the compounding problem of nested em values.

Q37. What is a CSS variable (custom property)?
A) A JavaScript variable B) A value defined with `--name: value` on an element and referenced with `var(--name)`, scoped to that element and its descendants C) A preprocessor feature D) A media query
Answer: B — CSS variables cascade and can be updated with JavaScript: `element.style.setProperty('--color', 'red')`.

Q38. What is the `position: sticky` value?
A) An absolute position B) An element that is positioned relative until a scroll threshold is reached, then behaves as fixed relative to its scroll container C) A fixed position D) A relative position
Answer: B — Commonly used for table headers and sticky navigation within content sections.

Q39. What is the `z-index` property?
A) A zoom index B) Controls the stacking order of positioned elements along the z-axis — higher values appear in front C) A CSS variable D) A layout property
Answer: B — z-index only works on positioned elements (position other than static).

Q40. What is a CSS stacking context?
A) A z-index value B) A conceptual layer created by certain CSS properties (position + z-index, opacity < 1, transform, filter) within which child elements are stacked relative to each other C) A z-index hierarchy D) CSS layers
Answer: B — Understanding stacking contexts is essential for debugging z-index issues.

Q41. What is the `will-change` CSS property?
A) Future CSS changes B) Hints to the browser which properties will animate, allowing it to optimize by creating a compositor layer in advance C) A transition property D) A performance hack
Answer: B — Use sparingly — it increases memory usage. Apply only to elements that will actually animate.

Q42. What is `contain` CSS property?
A) Overflow containment B) Tells the browser an element's subtree is independent from the rest of the page, enabling rendering optimizations C) A layout property D) Box sizing
Answer: B — `contain: layout paint` prevents layout recalculations from propagating.

### Fill in the Blank

Q43. The CSS ________ property controls how an element handles content that overflows its boundaries.
Answer: overflow

Q44. The ________ selector selects all direct children of an element.
Answer: `>` (child combinator) — e.g., `ul > li`

Q45. The CSS ________ property sets the stacking order of a flex container's children when they wrap to multiple lines.
Answer: align-content

Q46. ________ is a CSS function applying a 2D or 3D transformation — translate, rotate, scale, skew.
Answer: transform

Q47. The CSS ________ property defines whether an element generates a block or inline box — or other box types like flex or grid.
Answer: display

Q48. ________ is the CSS property controlling the space between flex items or grid items.
Answer: gap (formerly grid-gap)

Q49. The ________ CSS property determines whether absolute-positioned child elements are positioned relative to this element.
Answer: position (set to relative, absolute, fixed, or sticky)

Q50. The ________ rule applies CSS only when certain conditions are met — screen width, orientation, print.
Answer: @media (media query)

Q51. ________ is the CSS property controlling how text that overflows its container is displayed — clip, ellipsis.
Answer: text-overflow

Q52. The CSS ________ shorthand sets the border-radius of all four corners, creating rounded corners.
Answer: border-radius

---

## TOPIC 3: CSS LAYOUTS — FLEXBOX AND GRID

### Concept MCQ

Q53. What is Flexbox?
A) A JavaScript library B) A CSS layout model providing a one-dimensional layout system (row or column) for distributing space and aligning items C) A CSS framework D) A grid system
Answer: B — Flexbox is ideal for one-dimensional layouts and component-level alignment.

Q54. What is the difference between `justify-content` and `align-items` in Flexbox?
A) No difference B) `justify-content` aligns items along the main axis (row direction); `align-items` aligns items along the cross axis (column direction) C) Both do the same D) They apply to grid only
Answer: B — Main axis direction is set by `flex-direction`.

Q55. What does `flex: 1` shorthand mean?
A) One flex item B) `flex-grow: 1; flex-shrink: 1; flex-basis: 0%` — the item grows to fill available space equally C) Fixed width D) Minimum size
Answer: B — `flex: 1` is the most common shorthand for equal-space-filling items.

Q56. What is `align-self` in Flexbox?
A) Self-centering B) Overrides the container's `align-items` for a specific flex item, controlling its cross-axis alignment individually C) Self-sizing D) Self-ordering
Answer: B — Useful when one item needs different alignment than its siblings.

Q57. What is CSS Grid?
A) A table layout B) A two-dimensional CSS layout system enabling control over both rows and columns simultaneously C) A flexbox variant D) A CSS framework
Answer: B — Grid is ideal for page-level layouts and two-dimensional component arrangements.

Q58. What is the `fr` unit in CSS Grid?
A) A fraction of the font B) A fractional unit representing a fraction of available space in the grid container after fixed sizes are subtracted C) A fixed pixel D) A flexible rem
Answer: B — `grid-template-columns: 1fr 2fr 1fr` creates three columns where the middle is twice as wide.

Q59. What does `grid-template-areas` allow you to do?
A) Name grid items B) Define a visual layout using named areas — reference these names in `grid-area` on individual items for an intuitive layout description C) Set template sizes D) Define grid rows
Answer: B — Makes complex layouts readable and maintainable.

Q60. What is `minmax()` in CSS Grid?
A) A math function B) A function setting a minimum and maximum size for a grid track — `minmax(200px, 1fr)` means "at least 200px but grow if space allows" C) A clamp function D) A media query
Answer: B — Enables responsive grids without media queries.

Q61. What is `auto-fill` vs `auto-fit` in CSS Grid?
A) No difference B) Both fill rows with as many columns as possible; `auto-fill` creates empty tracks at the end; `auto-fit` collapses empty tracks so existing items expand C) auto-fill is deprecated D) auto-fit creates fixed columns
Answer: B — Used with `repeat(auto-fill, minmax(200px, 1fr))` for responsive grids.

Q62. When should you use Flexbox vs Grid?
A) Always use Grid B) Flexbox for one-dimensional layouts (a row of items or a column); Grid for two-dimensional layouts needing row and column control simultaneously C) Always use Flexbox D) They are equivalent
Answer: B — They complement each other and are often used together.

### Fill in the Blank

Q63. The CSS property ________ defines the main axis direction of a flex container — row or column.
Answer: flex-direction

Q64. ________ controls whether flex items are forced onto one line or can wrap onto multiple lines.
Answer: flex-wrap

Q65. The Grid shorthand ________ defines both rows and columns in one declaration.
Answer: grid-template (or grid-template: rows / columns)

Q66. The ________ property on a grid item specifies which row lines it spans from and to.
Answer: grid-row (or grid-row-start / grid-row-end)

Q67. ________ is a CSS Grid feature placing items automatically into the next available cell, controlled by the `grid-auto-flow` property.
Answer: Auto-placement

Q68. The CSS ________ function creates a responsive grid with as many columns as fit, each at least a minimum size.
Answer: repeat(auto-fill, minmax())

Q69. ________ in Flexbox specifies the initial main size of a flex item before free space distribution.
Answer: flex-basis

Q70. The ________ property in Grid places a named grid area shorthand spanning rows and columns.
Answer: grid-area

### Scenario

Q71. You need to center a div both horizontally and vertically inside its parent. Give three CSS solutions.
Answer: Solution 1 — Flexbox: parent gets `display: flex; justify-content: center; align-items: center`. Solution 2 — Grid: parent gets `display: grid; place-items: center`. Solution 3 — Absolute positioning: child gets `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%)` with parent `position: relative`. Solution 4 (modern): `position: absolute; inset: 0; margin: auto` with a defined width/height on the child. Flexbox and Grid solutions are the most maintainable. The absolute positioning approach is useful when the parent cannot be a flex/grid container.

Q72. Design a responsive card grid that shows 1 column on mobile, 2 on tablet, and 3 on desktop using CSS Grid.
Answer: `.card-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }` then `@media (min-width: 600px) { .card-grid { grid-template-columns: repeat(2, 1fr); } }` and `@media (min-width: 900px) { .card-grid { grid-template-columns: repeat(3, 1fr); } }`. Or with no media queries using auto-fill: `.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }` — this automatically creates as many columns as fit, achieving the same result responsively without breakpoints.

---

## TOPIC 4: RESPONSIVE DESIGN

### Concept MCQ

Q73. What is responsive web design?
A) Fast-loading websites B) Design approach making websites adapt to different screen sizes, orientations, and device capabilities using fluid grids, flexible images, and media queries C) A CSS framework D) Mobile-only design
Answer: B — Coined by Ethan Marcotte; foundational to modern web development.

Q74. What is a viewport meta tag and why is it essential?
A) Sets page title B) `<meta name="viewport" content="width=device-width, initial-scale=1">` instructs mobile browsers to use the device width rather than a virtual 980px viewport C) Links stylesheets D) Sets character encoding
Answer: B — Without it, mobile browsers zoom out to show the full desktop-width page.

Q75. What is mobile-first design?
A) Designing for mobile users only B) Starting CSS design for the smallest screens and progressively enhancing for larger screens using min-width media queries C) A framework approach D) Removing desktop features
Answer: B — Mobile-first produces leaner CSS and naturally prioritizes core content and performance.

Q76. What is the difference between min-width and max-width in media queries?
A) No difference B) min-width applies styles from a breakpoint upward (mobile-first); max-width applies styles from a breakpoint downward (desktop-first) C) max-width is deprecated D) min-width is for fonts only
Answer: B — Mobile-first uses min-width; desktop-first uses max-width.

Q77. What is fluid typography?
A) Animated text B) Typography that scales smoothly between a minimum and maximum size based on viewport width, using `clamp()` or `vw` units C) Responsive font loading D) Variable fonts
Answer: B — `font-size: clamp(1rem, 2.5vw, 2rem)` — min, preferred, max.

Q78. What are common responsive design breakpoints?
A) Fixed pixel values B) Viewport widths where layouts shift — commonly around 480px (mobile), 768px (tablet), 1024px (small desktop), 1280px (large desktop) though content should guide breakpoints C) Fixed device sizes D) CSS framework sizes
Answer: B — Better approach: let content determine breakpoints, not specific devices.

Q79. What is the difference between adaptive and responsive design?
A) No difference B) Responsive uses fluid, percentage-based layouts adapting smoothly; adaptive uses fixed layouts for specific detected device widths C) Adaptive is newer D) Responsive is server-side
Answer: B — Responsive is the dominant modern approach; adaptive was common in early mobile web development.

Q80. What is `clamp()` in CSS?
A) A JavaScript method B) A CSS function taking minimum, preferred, and maximum values — `clamp(min, preferred, max)` — the value is constrained between min and max C) A flexbox property D) A grid function
Answer: B — Enables fluid sizing without media queries.

### Fill in the Blank

Q81. ________ units represent a percentage of the viewport width (vw) or height (vh), enabling viewport-relative sizing.
Answer: Viewport units (vw, vh, vmin, vmax)

Q82. The CSS ________ approach serves different image sizes based on screen resolution using srcset and sizes attributes.
Answer: Responsive images

Q83. ________ is a CSS approach using logical properties (block-start, inline-end) instead of physical ones (top, right) to support RTL languages.
Answer: Logical properties (CSS Logical Properties)

Q84. The ________ meta property `content="width=device-width"` sets the viewport width equal to the device's screen width.
Answer: viewport

Q85. ________ is the practice of hiding non-critical content on small screens using `display: none` in CSS.
Answer: Progressive disclosure (or responsive hiding)

---

## TOPIC 5: JAVASCRIPT FUNDAMENTALS

### Concept MCQ

Q86. What is the difference between `var`, `let`, and `const`?
A) No difference B) `var` is function-scoped and hoisted; `let` is block-scoped; `const` is block-scoped and cannot be reassigned C) `const` cannot change D) `var` is deprecated
Answer: B — Use `const` by default, `let` when reassignment is needed, avoid `var`.

Q87. What is hoisting in JavaScript?
A) Moving code to a server B) JavaScript's behavior of moving variable and function declarations to the top of their scope before code executes — `var` declarations and function declarations are hoisted C) A scope mechanism D) Variable assignment
Answer: B — `var` is hoisted and initialized as `undefined`. `let` and `const` are hoisted but in a temporal dead zone.

Q88. What is the difference between `==` and `===`?
A) No difference B) `==` performs type coercion before comparison; `===` checks value and type without coercion — always prefer `===` C) `===` is slower D) `==` is more strict
Answer: B — `1 == "1"` is true; `1 === "1"` is false.

Q89. What is a closure in JavaScript?
A) A closed loop B) A function that retains access to its outer scope's variables even after the outer function has returned C) A class method D) A module
Answer: B — Closures are fundamental to data encapsulation, module patterns, and callbacks.

Q90. What is the event loop in JavaScript?
A) A for loop for events B) The mechanism allowing JavaScript's single thread to handle asynchronous operations by processing the call stack, microtask queue, and macrotask queue C) An event handler D) A DOM event
Answer: B — The event loop enables non-blocking I/O in a single-threaded environment.

Q91. What is the difference between the call stack, microtask queue, and macrotask queue?
A) All the same B) Call stack: synchronous code execution. Microtask queue: Promise callbacks, runs after each task before rendering. Macrotask queue: setTimeout, setInterval, processed one per event loop iteration C) All are asynchronous D) Macrotasks run first
Answer: B — Microtasks always drain completely before the next macrotask runs.

Q92. What is a Promise?
A) A commitment B) An object representing the eventual completion or failure of an async operation, with `.then()`, `.catch()`, and `.finally()` handlers C) A callback D) An async function
Answer: B — Promises replaced callback hell as the standard for async JavaScript.

Q93. What is `async/await`?
A) Two different things B) Syntactic sugar over Promises — `async` marks a function as asynchronous; `await` pauses execution until a Promise resolves, enabling synchronous-looking async code C) A new async model D) Synchronous code
Answer: B — `async/await` makes asynchronous code more readable without changing the underlying Promise mechanism.

Q94. What is the difference between `null` and `undefined`?
A) No difference B) `undefined` means a variable has been declared but not assigned; `null` is an explicit assignment indicating the intentional absence of a value C) Both are falsy only D) `null` is an error
Answer: B — `typeof null === 'object'` is a historical JavaScript bug.

Q95. What is prototypal inheritance?
A) Class-based inheritance B) JavaScript's inheritance model where objects inherit directly from other objects via a prototype chain — each object has a `__proto__` link to its prototype C) A design pattern D) An ES6 feature
Answer: B — ES6 `class` syntax is syntactic sugar over prototypal inheritance.

Q96. What is the `this` keyword in JavaScript?
A) The current file B) A context-dependent keyword referring to the object a function was called on — its value depends on how and where the function is called C) A global variable D) A class reference
Answer: B — Arrow functions do not have their own `this` — they inherit from the enclosing lexical scope.

Q97. What is the spread operator?
A) A multiplication operator B) `...` — expands an iterable (array, object) into individual elements — used for array/object copying, merging, and function arguments C) A rest parameter D) A destructuring operator
Answer: B — `[...arr1, ...arr2]` merges arrays. `{...obj1, ...obj2}` merges objects.

Q98. What is destructuring in JavaScript?
A) Breaking objects B) Extracting values from arrays or properties from objects into distinct variables with concise syntax C) A spread operator D) A rest parameter
Answer: B — `const { name, age } = user;` and `const [first, second] = arr;`.

Q99. What are JavaScript modules?
A) npm packages B) Files that export and import functionality — ES modules use `export`/`import` syntax; each module has its own scope C) JavaScript classes D) Node.js only
Answer: B — ES modules are now supported natively in modern browsers.

Q100. What is the difference between `forEach`, `map`, `filter`, and `reduce`?
A) No difference B) forEach: iterate without returning. map: transform each element into a new array. filter: return subset matching a condition. reduce: accumulate to a single value C) All return arrays D) forEach returns a new array
Answer: B — Understanding these functional array methods is essential for modern JavaScript.

### Fill in the Blank

Q101. ________ is a JavaScript method returning a new Promise that resolves when all passed Promises resolve, or rejects when any one rejects.
Answer: Promise.all()

Q102. The ________ operator returns the value on its left if it is not null/undefined, otherwise the value on its right.
Answer: Nullish coalescing (??)

Q103. Optional chaining ________ accesses a property or calls a method, returning undefined instead of throwing if the left side is null/undefined.
Answer: ?. (optional chaining operator)

Q104. ________ is a JavaScript method copying object properties from one or more source objects to a target object.
Answer: Object.assign() (or spread operator)

Q105. The ________ method creates a new array populated with the results of calling a function on every element.
Answer: Array.prototype.map()

Q106. ________ is a JavaScript array method that tests whether at least one element passes the provided test function.
Answer: Array.prototype.some()

Q107. ________ is JavaScript's mechanism for converting objects to JSON strings and back.
Answer: JSON.stringify() and JSON.parse()

Q108. The ________ event fires when the initial HTML is fully loaded and parsed, before stylesheets and images finish loading.
Answer: DOMContentLoaded

Q109. ________ is a JavaScript technique delaying function execution until after a specified time has elapsed since the last call.
Answer: Debouncing

Q110. ________ is a JavaScript technique ensuring a function executes at most once per specified time interval.
Answer: Throttling

### Scenario

Q111. Explain how you would implement a debounce function from scratch in JavaScript.
Answer:
```javascript
function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
// Usage: const debouncedSearch = debounce(searchAPI, 300);
// input.addEventListener('input', debouncedSearch);
```
Every time the returned function is called, it clears the previous timer and sets a new one. The original function only executes if no new call arrives within the delay period. Commonly used for search inputs, window resize handlers, and form validation.

Q112. You notice a memory leak in a React-like component. It adds an event listener but never removes it. How do you fix this in vanilla JavaScript?
Answer: Always pair addEventListener with removeEventListener in cleanup. Store the handler reference so it can be removed:
```javascript
function setupComponent(element) {
  function handleClick(e) { /* ... */ }
  element.addEventListener('click', handleClick);
  // Return cleanup function
  return function cleanup() {
    element.removeEventListener('click', handleClick);
  };
}
const cleanup = setupComponent(myElement);
// Later when component unmounts:
cleanup();
```
Also clean up: timers (clearTimeout, clearInterval), Intersection/Resize Observer disconnects, AbortControllers for fetch requests, and WebSocket connections. Memory leaks accumulate in single-page applications where components mount and unmount frequently.

---

## TOPIC 6: DOM MANIPULATION

### Concept MCQ

Q113. What is the DOM?
A) A JavaScript library B) Document Object Model — a programming interface representing an HTML document as a tree of objects that JavaScript can query and manipulate C) A CSS model D) A server API
Answer: B — The DOM is the bridge between HTML and JavaScript.

Q114. What is the difference between `innerHTML` and `textContent`?
A) No difference B) `innerHTML` parses and renders HTML markup; `textContent` treats content as plain text — use `textContent` when inserting user content to prevent XSS C) textContent is deprecated D) innerHTML is safer
Answer: B — `innerHTML` with user input creates XSS vulnerabilities.

Q115. What is event bubbling?
A) Floating events B) Events propagating from the target element up through its parent elements to the document root, triggering handlers on each ancestor C) Event delegation D) Event capture
Answer: B — Bubbling is the default propagation direction (inside-out).

Q116. What is event capturing?
A) Recording events B) The first phase of event propagation where events travel from the document root down to the target element — enabled by passing `true` as the third argument to addEventListener C) Event bubbling D) Event delegation
Answer: B — Capture phase occurs before the bubble phase.

Q117. What is event delegation?
A) Assigning events to others B) Attaching a single event listener to a parent element to handle events from multiple child elements using event bubbling C) Event bubbling D) An event model
Answer: B — More efficient than adding listeners to many individual elements; works for dynamically added elements.

Q118. What does `event.stopPropagation()` do?
A) Stops the event completely B) Prevents the event from bubbling up to parent elements or capturing down, but does not prevent the default browser behavior C) Prevents default D) Removes the listener
Answer: B — `event.preventDefault()` prevents the default browser action (form submission, link navigation).

Q119. What is the difference between `querySelector` and `querySelectorAll`?
A) No difference B) `querySelector` returns the first matching element or null; `querySelectorAll` returns a static NodeList of all matching elements C) querySelectorAll is faster D) querySelector uses IDs only
Answer: B — `querySelectorAll` returns a static NodeList, not a live HTMLCollection.

Q120. What is a DocumentFragment?
A) A DOM element B) A lightweight DOM node serving as a container to build a tree of nodes in memory before appending to the document — minimizes DOM reflows C) A virtual DOM D) A template element
Answer: B — Batch DOM updates using DocumentFragment for better performance.

Q121. What is the MutationObserver API?
A) A CSS observer B) An API observing changes to the DOM tree — additions, removals, attribute changes, text changes — asynchronously C) An event listener D) A performance API
Answer: B — MutationObserver replaced the deprecated Mutation Events for performance reasons.

Q122. What is the IntersectionObserver API?
A) Checking DOM intersections B) An API observing whether target elements intersect the viewport or a parent element — used for lazy loading, infinite scroll, and animation triggers C) A scroll event D) A resize observer
Answer: B — Much more performant than scroll event + getBoundingClientRect calculations.

### Fill in the Blank

Q123. ________ creates a new HTML element in memory that can be manipulated before being inserted into the document.
Answer: document.createElement()

Q124. The ________ method inserts a node before a reference node as a child of a specified parent.
Answer: parentNode.insertBefore() (or Element.before())

Q125. ________ inserts HTML adjacent to an element at a specified position: 'beforebegin', 'afterbegin', 'beforeend', 'afterend'.
Answer: element.insertAdjacentHTML()

Q126. The ________ method clones an element, with a boolean parameter controlling whether children are also cloned.
Answer: element.cloneNode(deep)

Q127. ________ is the modern method removing an element from the DOM without needing a reference to the parent.
Answer: element.remove()

---

## TOPIC 7: JAVASCRIPT ADVANCED

### Concept MCQ

Q128. What is a generator function?
A) A function generating random values B) A function that can pause execution and resume later, using `function*` syntax and `yield` to produce a sequence of values lazily C) An async function D) A constructor
Answer: B — Generators are useful for infinite sequences, lazy evaluation, and implementing iterators.

Q129. What is the Proxy object in JavaScript?
A) A network proxy B) An object wrapping another object and intercepting operations (get, set, delete, apply) through handler traps — enabling validation, logging, and reactivity C) A middleware D) A design pattern
Answer: B — Vue 3's reactivity system uses Proxy to detect and react to data changes.

Q130. What is the Reflect API?
A) CSS reflections B) A built-in object providing static methods for interceptable JavaScript operations — mirrors Proxy trap methods and is often used alongside Proxy C) A mirror API D) An object utility
Answer: B — `Reflect.get(target, key)` is the programmatic equivalent of `target[key]`.

Q131. What are WeakMap and WeakSet?
A) Weak collections B) Collections whose keys (WeakMap) or values (WeakSet) are held weakly — if the key has no other references, it is garbage collected, preventing memory leaks C) Regular maps D) Deprecated structures
Answer: B — Use WeakMap for associating data with DOM elements without preventing garbage collection.

Q132. What is tail call optimization?
A) Optimizing the last function B) An optimization where the last operation in a function is a function call, enabling the engine to reuse the current stack frame — preventing stack overflow in recursion C) A loop optimization D) An async optimization
Answer: B — Only applies in strict mode and when the recursive call is the last expression.

Q133. What are Symbol primitives?
A) Math symbols B) Unique, immutable values used as object property keys that never conflict with other property names — useful for defining well-known behaviors C) Encrypted values D) String identifiers
Answer: B — `Symbol('description')` creates a unique symbol. Used for `Symbol.iterator`, `Symbol.toPrimitive`.

Q134. What is the Iterator protocol?
A) A network protocol B) An interface where objects implement a `next()` method returning `{ value, done }`, making them iterable with for...of loops C) An async pattern D) A generator feature
Answer: B — Arrays, Maps, Sets, Strings, NodeLists implement the iterator protocol.

Q135. What is tagged template literals?
A) HTML templates B) Template literals called with a function prefix — the function receives the template strings array and interpolated values, enabling custom processing C) Regular template literals D) Tagged HTML
Answer: B — Used by styled-components, GraphQL queries (gql``), and SQL templating.

Q136. What is object destructuring with default values?
A) Setting defaults B) Providing fallback values in destructuring when a property is undefined: `const { name = 'Anonymous', age = 0 } = user;` C) Optional chaining D) Nullish coalescing
Answer: B — Combines destructuring with default parameter patterns.

Q137. What is the difference between shallow copy and deep copy of objects?
A) No difference B) Shallow copy copies the top-level properties but nested objects are still referenced; deep copy recursively copies all nested objects creating fully independent copies C) Deep copy is always needed D) Spread always deep copies
Answer: B — Spread `{...obj}` and Object.assign() are shallow. Use structuredClone() for deep copy.

### Fill in the Blank

Q138. ________ is a built-in JavaScript method for performing deep copies of most JavaScript values without JSON limitations.
Answer: structuredClone()

Q139. ________ is a JavaScript design pattern using a queue to process items sequentially, commonly implemented with Promise chains.
Answer: Promise chaining (or sequential async operations)

Q140. The ________ method pauses a generator function and returns the next value in its sequence.
Answer: yield

Q141. ________ is a method allowing an array-like object to borrow and call a function from another object with a specified `this`.
Answer: Function.prototype.call() or Function.prototype.apply()

Q142. ________ permanently binds a function to a specific `this` value, returning a new function.
Answer: Function.prototype.bind()

Q143. ________ is the process by which JavaScript converts objects to their equivalent string or numeric values.
Answer: Type coercion (or implicit type conversion)

Q144. ________ is a modern JavaScript pattern using private class fields with the `#` prefix.
Answer: Private class fields

Q145. ________ is a JavaScript proposal allowing top-level `await` outside of async functions, available in ES modules.
Answer: Top-level await

---

## TOPIC 8: BROWSER APIs AND WEB PLATFORM

### Concept MCQ

Q146. What is the Fetch API?
A) Data fetching library B) A modern browser API for making HTTP requests using Promises, replacing XMLHttpRequest with a cleaner, more powerful interface C) An Ajax library D) Node.js API
Answer: B — `fetch(url).then(r => r.json()).then(data => ...)`.

Q147. What is localStorage vs sessionStorage vs cookies?
A) Same storage types B) localStorage: persistent across sessions; sessionStorage: cleared when tab closes; cookies: sent with HTTP requests, can have expiry, accessible server-side C) Cookies are most secure D) sessionStorage persists
Answer: B — Use cookies for server-side access (auth tokens), localStorage for client-side persistence, sessionStorage for session-scoped data.

Q148. What is IndexedDB?
A) An indexed array B) A low-level browser API for client-side storage of structured data including files and blobs, supporting transactions and indexing — much larger capacity than localStorage C) A cache API D) A service worker API
Answer: B — Use libraries like Dexie.js for a friendlier API over IndexedDB.

Q149. What is the Web Storage API?
A) Cloud storage B) The browser API providing localStorage and sessionStorage for storing key-value pairs on the client, with a synchronous interface and ~5-10MB limit C) A file system D) A cookie API
Answer: B — Web Storage is simpler than IndexedDB for straightforward client-side data storage.

Q150. What is a service worker?
A) A web developer B) A JavaScript file running in a background thread separate from the main page — enabling offline support, push notifications, background sync, and cache control C) A web server D) A Web Worker
Answer: B — Service workers are the foundation of Progressive Web Apps (PWAs).

Q151. What is the Cache API?
A) Browser cache settings B) A programmable cache storage for request/response pairs, used by service workers to store assets for offline access C) HTTP caching D) A memory cache
Answer: B — Service workers use the Cache API to implement offline-first strategies.

Q152. What is a Web Worker?
A) A web developer B) A script running in a background thread, enabling parallel JavaScript execution without blocking the main thread — no DOM access C) A service worker D) A shared worker
Answer: B — Use Web Workers for heavy computations: image processing, data parsing, cryptography.

Q153. What is the WebSocket API?
A) A socket file B) A protocol and browser API enabling full-duplex, persistent bidirectional communication between browser and server over a single connection C) An HTTP variant D) A polling mechanism
Answer: B — WebSockets enable real-time features: chat, live updates, multiplayer games.

Q154. What is the History API?
A) Browser history B) A browser API enabling manipulation of the browser session history — `pushState`, `replaceState`, and the `popstate` event enable client-side routing without full page reloads C) A navigation API D) Router API
Answer: B — The foundation of single-page application routing.

Q155. What is the Intersection Observer API?
A) DOM intersection B) An asynchronous API observing changes in the intersection of elements with the viewport or a parent, used for lazy loading, infinite scroll, and scroll-triggered animations C) A scroll listener D) A DOM observer
Answer: B — Far more performant than scroll event listeners for visibility detection.

### Fill in the Blank

Q156. ________ is a browser API providing access to media devices (camera, microphone) for capturing audio and video.
Answer: MediaDevices API (getUserMedia)

Q157. The ________ API allows reading and writing files on the user's local file system with their permission.
Answer: File System Access API

Q158. ________ is a browser API for running WebAssembly modules, enabling near-native performance for compute-intensive tasks.
Answer: WebAssembly API (WebAssembly.instantiate)

Q159. The ________ event fires when the browser window is resized.
Answer: resize (window.addEventListener('resize', handler))

Q160. ________ is a browser API providing cryptographic functions including key generation, encryption, and hashing.
Answer: Web Crypto API (SubtleCrypto)

---

## TOPIC 9: TYPESCRIPT

### Concept MCQ

Q161. What is TypeScript?
A) A new programming language B) A statically typed superset of JavaScript that compiles to JavaScript, adding optional type annotations, interfaces, and enhanced tooling C) A JavaScript framework D) A testing tool
Answer: B — TypeScript improves developer experience and catches type-related bugs at compile time.

Q162. What is a TypeScript interface?
A) A UI component B) A type definition describing the shape of an object — its property names, types, and optionality — used for type checking without runtime overhead C) An abstract class D) A module
Answer: B — Interfaces are erased at compile time; they have no runtime representation.

Q163. What is the difference between `interface` and `type` in TypeScript?
A) No difference B) Both describe shapes; interfaces can be extended/merged with `extends` and declaration merging; type aliases can represent any type including unions, intersections, and primitives C) type is always preferred D) interface is deprecated
Answer: B — Use interface for object shapes that may be extended; use type for unions, intersections, and complex types.

Q164. What is a generic in TypeScript?
A) A general type B) A type variable enabling functions, classes, and interfaces to work with any type while maintaining type safety — `function identity<T>(arg: T): T` C) A wildcard D) An any type
Answer: B — Generics provide reusability without sacrificing type safety.

Q165. What is the TypeScript `unknown` type vs `any`?
A) No difference B) `any` disables type checking entirely; `unknown` is the type-safe counterpart — you must type-check before operating on an `unknown` value C) unknown is deprecated D) any is stricter
Answer: B — Prefer `unknown` over `any` when the type is genuinely unknown — it forces proper type checking.

Q166. What is a union type in TypeScript?
A) Combining all types B) A type that can be one of several types: `string | number | boolean` — the variable can hold any of the specified types C) A class union D) An enum
Answer: B — Use discriminated unions for type-safe variant handling.

Q167. What is a TypeScript discriminated union?
A) A biased union B) A union type where each member has a common literal property (discriminant) enabling exhaustive pattern matching with type narrowing C) A regular union D) An enum
Answer: B — `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }`.

Q168. What is a TypeScript decorator?
A) A CSS decorator B) A design pattern applied to classes, methods, properties, or parameters — implemented as functions adding behavior or metadata at declaration time C) A comment D) An annotation
Answer: B — Used in Angular and NestJS extensively. Requires `experimentalDecorators: true` in tsconfig.

Q169. What is `keyof` in TypeScript?
A) Object keys B) A type operator producing a union of all key names of a given type: `type Keys = keyof User` produces `'name' | 'age' | 'email'` C) Object.keys() D) An index type
Answer: B — Used with mapped types to create transformations over object types.

Q170. What are TypeScript utility types?
A) Utility functions B) Built-in generic types transforming other types — Partial<T>, Required<T>, Readonly<T>, Pick<T,K>, Omit<T,K>, Record<K,V>, ReturnType<F> C) Type aliases D) Interface extensions
Answer: B — Utility types reduce boilerplate in TypeScript definitions.

### Fill in the Blank

Q171. The TypeScript ________ operator narrows a type by checking if an object has a specific property.
Answer: in (type narrowing with `in` operator)

Q172. ________ is a TypeScript feature inferring the type from a type member based on the value of another member.
Answer: Conditional types (T extends U ? X : Y)

Q173. The ________ assertion tells TypeScript you know better than it does about the type of a value.
Answer: Type assertion (as Type or `<Type>` syntax)

Q174. ________ is a TypeScript compiler option making all properties of types optional by default.
Answer: No such global option — use Partial<T> utility type

Q175. The ________ keyword in TypeScript declares a function will never return normally — it throws or runs forever.
Answer: never (return type never)

---

## TOPIC 10: REACT

### Concept MCQ

Q176. What is React?
A) A full-stack framework B) A JavaScript library for building user interfaces using a component-based architecture and a virtual DOM for efficient updates C) A template engine D) A state management tool
Answer: B — React focuses on the view layer; it is not a full framework.

Q177. What is the virtual DOM?
A) A separate browser B) An in-memory representation of the real DOM. React diffs the virtual DOM to determine the minimal set of actual DOM updates needed C) A DOM backup D) A JavaScript object
Answer: B — Virtual DOM enables declarative UI programming with efficient updates.

Q178. What is JSX?
A) JavaScript XML framework B) A syntax extension for JavaScript that looks like HTML and compiles to `React.createElement()` calls C) A template language D) An HTML variant
Answer: B — JSX requires a transpiler (Babel) and must have a single root element or Fragment.

Q179. What is a React hook?
A) A lifecycle method B) A function letting functional components use React features — state (useState), effects (useEffect), context (useContext), and custom reusable logic C) A class method D) A prop type
Answer: B — Hooks were introduced in React 16.8 and replaced most class component patterns.

Q180. What is `useState`?
A) A global state B) A hook returning a state variable and a setter function — `const [count, setCount] = useState(0)` — re-renders the component when state changes C) A context D) A reducer
Answer: B — Always use the setter function; never mutate state directly.

Q181. What is `useEffect`?
A) A side-effect library B) A hook running a function after every render (or on specific dependency changes) for side effects — data fetching, subscriptions, DOM manipulation C) A lifecycle method D) An event handler
Answer: B — Return a cleanup function to prevent memory leaks.

Q182. What is the dependency array in `useEffect`?
A) A list of dependencies B) The second argument controlling when the effect runs — empty array `[]` runs once on mount, specific values `[id]` run when those values change, omitted runs after every render C) Optional metadata D) Import list
Answer: B — Wrong dependencies cause stale closures or infinite render loops.

Q183. What is `useMemo`?
A) A memory hook B) A hook caching the result of an expensive computation, recomputing only when dependencies change — prevents recalculation on every render C) A component cache D) A state optimizer
Answer: B — Use for expensive calculations, not for every value — premature optimization is costly.

Q184. What is `useCallback`?
A) A callback hook B) A hook memoizing a function reference, returning the same function instance unless dependencies change — prevents unnecessary child re-renders when passing callbacks as props C) A function cache D) An event hook
Answer: B — Use with `React.memo` to prevent child re-renders caused by new function references.

Q185. What is React.memo?
A) A memory utility B) A higher-order component that memoizes a component's rendered output, skipping re-render if props have not changed (shallow comparison) C) A hook D) A context
Answer: B — Use for pure components receiving stable props to prevent unnecessary re-renders.

Q186. What is the Context API?
A) A global variable B) React's built-in solution for sharing state across the component tree without prop drilling — `createContext`, `Provider`, `useContext` C) A state manager D) A routing solution
Answer: B — For complex state, combine with useReducer or use a dedicated state library.

Q187. What is `useReducer`?
A) A Redux hook B) A hook managing complex state logic — takes a reducer function and initial state, returns current state and dispatch function — similar to Redux locally C) A state array D) A context hook
Answer: B — Prefer `useReducer` over `useState` when state logic involves multiple sub-values or complex transitions.

Q188. What is `useRef`?
A) A reference to a hook B) A hook returning a mutable object with a `current` property — persists between renders without triggering re-renders. Used for DOM access and storing mutable values C) A state reference D) An imperative hook
Answer: B — `ref.current` accessing a DOM node does not trigger re-render.

Q189. What is React reconciliation?
A) A conflict resolution B) The algorithm React uses to compare previous and current virtual DOM trees and determine the minimal set of DOM operations to update the UI C) A diffing algorithm D) Both B and C
Answer: D — Reconciliation is the process; diffing is the algorithm within it.

Q190. What are React keys and why are they important?
A) Object keys B) Unique identifiers on list items helping React identify which items changed, were added, or removed — enabling efficient reconciliation without re-rendering unchanged items C) Event keys D) CSS keys
Answer: B — Use stable unique IDs as keys, not array indices (indices cause bugs with reordering).

### Fill in the Blank

Q191. ________ is a React pattern passing components as props, enabling highly flexible and reusable components.
Answer: Render props

Q192. ________ is a React pattern wrapping a component to add functionality without modifying it.
Answer: Higher-Order Component (HOC)

Q193. The React ________ hook subscribes to an external store, replacing the pattern of using Context or Redux for reading external data.
Answer: useSyncExternalStore

Q194. ________ is a React hook running synchronously after all DOM mutations but before the browser paints — used for reading layout.
Answer: useLayoutEffect

Q195. ________ is a React feature splitting components into separate chunks loaded on demand.
Answer: React.lazy() with Suspense (code splitting)

Q196. ________ is a React 18 feature enabling components to show a fallback while waiting for async data or lazy-loaded components.
Answer: Suspense

Q197. ________ is a React 18 concurrent feature starting a low-priority state update that can be interrupted by higher-priority updates.
Answer: useTransition (or startTransition)

Q198. ________ is React's strict mode helper that double-invokes lifecycle methods to detect side effects in development.
Answer: React.StrictMode

Q199. ________ is a React pattern exposing component state or methods to parent components via refs.
Answer: useImperativeHandle

Q200. ________ is React's built-in solution for catching JavaScript errors anywhere in the component tree.
Answer: Error Boundary (class component with componentDidCatch)

### Scenario

Q201. Your React component re-renders too frequently, causing performance issues. How do you diagnose and fix it?
Answer: Diagnosis: use React DevTools Profiler to identify which components re-render and why. Check the "why did this render?" feature showing which props/state changed. Common causes and fixes: parent re-renders passing new object/array/function references each time — wrap with useMemo/useCallback. Context value changing on every render — memoize the context value object with useMemo. Component receiving unstable props — use React.memo with a custom comparison function. State updates causing entire tree to re-render — split context into multiple contexts for different concerns, or move state closer to where it is used. Unnecessary useEffect dependencies — audit dependency arrays carefully. For expensive renders: virtualize long lists with react-window or react-virtual.

Q202. How do you handle data fetching in React in 2024?
Answer: Modern approaches: React Query (TanStack Query) or SWR for client-side fetching — they handle caching, background refetching, loading/error states, deduplication, and stale-while-revalidate patterns. For React 18+, use Suspense-compatible data fetching. For server components (Next.js), fetch data directly in server components without useEffect — data is fetched on the server, not the client. Avoid raw useEffect for data fetching in new code — it has many footguns (race conditions, no caching, manual loading state). If raw useEffect is necessary, implement cleanup with AbortController to cancel in-flight requests when the component unmounts or dependencies change.

---

## TOPIC 11: STATE MANAGEMENT

### Concept MCQ

Q203. What is Redux?
A) A React library B) A predictable state container for JavaScript apps — state lives in a single store, updated via pure reducer functions in response to dispatched actions C) A Context API D) A React hook
Answer: B — Redux provides centralized, predictable state management with excellent devtools.

Q204. What is the Redux Toolkit (RTK)?
A) Redux utilities B) The official opinionated toolset for Redux simplifying setup with createSlice, createAsyncThunk, and configureStore — reduces boilerplate significantly C) A Redux alternative D) A testing tool
Answer: B — RTK is the recommended way to write Redux logic in 2024.

Q205. What is Zustand?
A) A German word B) A minimal, unopinionated state management library for React using hooks — much simpler API than Redux with no boilerplate C) A Redux variant D) A context solution
Answer: B — Zustand is increasingly popular for its simplicity and performance.

Q206. What is Jotai?
A) A Japanese word B) An atomic state management library for React where state is broken into small atoms, and components subscribe only to the atoms they use C) A Context variant D) A Redux alternative
Answer: B — Jotai and Recoil both use the atomic model popularized by Facebook's Recoil.

Q207. What is the difference between local state, server state, and global state?
A) All the same B) Local state: component-specific UI state. Server state: async data from APIs (React Query handles this). Global state: app-wide data like user auth (Redux/Zustand/Context) C) All need Redux D) Global state is always Redux
Answer: B — Not all state needs to be global — most should be as local as possible.

Q208. What is the flux architecture pattern?
A) A CSS pattern B) A unidirectional data flow pattern: View dispatches Actions → Dispatcher sends to Stores → Stores update → Views re-render. Redux is based on Flux principles C) An MVC variant D) A React pattern
Answer: B — Flux's one-way data flow makes state changes predictable and debuggable.

Q209. What is a Redux selector?
A) A CSS selector B) A function extracting specific data from the Redux store — memoized selectors (reselect) prevent unnecessary recomputations when state changes C) An action creator D) A reducer
Answer: B — `const selectUserName = state => state.user.name`.

Q210. What is RTK Query?
A) A GraphQL client B) A powerful data fetching and caching tool built into Redux Toolkit, providing automatic caching, background refetching, and loading state management C) A REST client D) An API tool
Answer: B — RTK Query can replace React Query in Redux-based applications.

### Fill in the Blank

Q211. ________ is the Redux pattern for handling asynchronous operations as action creators returning functions instead of plain objects.
Answer: Redux Thunk (or Redux Saga for complex async flows)

Q212. ________ is a Redux DevTools feature replaying a sequence of actions to reproduce a specific application state.
Answer: Time-travel debugging

Q213. ________ is the principle that Redux reducers must not mutate state directly but return a new state object.
Answer: Immutability (pure functions)

Q214. ________ is a Redux Toolkit utility creating action creators and reducers from a single slice definition.
Answer: createSlice

Q215. ________ is the Zustand API for subscribing to store changes outside React components.
Answer: store.subscribe()

---

## TOPIC 12: ROUTING

### Concept MCQ

Q216. What is client-side routing?
A) Server routing B) Navigation in single-page applications where JavaScript intercepts link clicks and updates the URL and rendered content without full page reloads C) File-based routing D) Hash routing
Answer: B — Client-side routing uses the History API for clean URLs.

Q217. What is React Router?
A) A page loader B) The de facto routing library for React apps — providing `<BrowserRouter>`, `<Route>`, `<Link>`, `useNavigate`, `useParams`, and `useLocation` hooks C) A Redux tool D) A navigation component
Answer: B — React Router v6 introduced a declarative route configuration approach.

Q218. What is the difference between hash routing and history routing?
A) No difference B) Hash routing uses `#/path` — works without server configuration but URLs look ugly. History routing uses clean `/path` URLs — requires server fallback to `index.html` for direct URL access C) Hash is modern D) History is not supported
Answer: B — Production deployments use history routing with a server catch-all rule.

Q219. What is code splitting in the context of routing?
A) Splitting code files B) Dynamically importing route components so their JavaScript is only loaded when the route is visited, reducing initial bundle size C) A routing feature D) A build tool feature
Answer: B — `React.lazy(() => import('./Dashboard'))` with `<Suspense>` fallback.

Q220. What is nested routing in React Router v6?
A) Nested components B) Defining routes inside parent routes — child routes are rendered inside the parent component's `<Outlet>` — enabling shared layouts and nested URLs C) A v6 feature D) URL parameters
Answer: B — Nested routing enables persistent layout components across child routes.

### Fill in the Blank

Q221. ________ is the React Router v6 hook returning a function for programmatic navigation.
Answer: useNavigate

Q222. ________ is the React Router component rendering the matched child route inside a parent layout route.
Answer: `<Outlet>`

Q223. ________ is a Next.js routing feature where file system structure defines URL routes automatically.
Answer: File-based routing

Q224. ________ is a URL parameter prefixed with `:` in React Router route definitions.
Answer: Dynamic segment (route parameter — accessed with useParams())

Q225. ________ is a React Router v6 feature loading data before rendering a route component.
Answer: loader (React Router Data API with loader and action)

---

## TOPIC 13: PERFORMANCE OPTIMIZATION

### Concept MCQ

Q226. What is the Critical Rendering Path?
A) An important code path B) The sequence of steps the browser takes to render a page: parse HTML, build DOM, parse CSS, build CSSOM, combine into render tree, layout, paint C) A network path D) A JavaScript path
Answer: B — Optimizing the Critical Rendering Path reduces time to first meaningful paint.

Q227. What is Largest Contentful Paint (LCP)?
A) The largest image on a page B) A Core Web Vitals metric measuring when the largest above-the-fold content element becomes visible — good LCP is under 2.5 seconds C) A paint event D) A CSS metric
Answer: B — Improve LCP by optimizing images, server response time, and removing render-blocking resources.

Q228. What is Cumulative Layout Shift (CLS)?
A) A CSS shift B) A Core Web Vitals metric measuring unexpected layout shifts during page load — good CLS is under 0.1. Caused by images without dimensions, dynamic content C) A scroll shift D) A font shift
Answer: B — Fix CLS by always setting width and height on images and avoiding inserting content above existing content.

Q229. What is First Input Delay (FID) / Interaction to Next Paint (INP)?
A) A server metric B) FID measures time from first user interaction to browser response; INP (replacing FID as a Core Web Vital) measures the worst interaction latency across all interactions C) A network metric D) A DOM metric
Answer: B — Improve by breaking up long tasks and using web workers for heavy computation.

Q230. What is code splitting?
A) Splitting code across files B) Breaking a JavaScript bundle into smaller chunks loaded on demand — reduces initial load time by only downloading code needed for the current view C) Minification D) Tree shaking
Answer: B — Implement with dynamic `import()`, React.lazy, or route-based splitting in bundlers.

Q231. What is tree shaking?
A) Removing a tree element B) Eliminating dead code (unused exports) from JavaScript bundles during build — bundlers like webpack and Rollup analyze static import/export to identify unused code C) A DOM optimization D) A minification step
Answer: B — Requires ES module syntax (import/export, not require/module.exports).

Q232. What is lazy loading?
A) Slow loading B) Deferring the loading of non-critical resources (images, components, routes) until they are needed — reduces initial page load time C) Infinite scroll D) Preloading
Answer: B — Use `loading="lazy"` on images, `React.lazy` for components, and IntersectionObserver for custom lazy loading.

Q233. What is image optimization for the web?
A) Resizing images B) Choosing correct format (WebP/AVIF), appropriate dimensions, proper compression, srcset for responsive images, lazy loading, and CDN delivery C) CSS filters D) Image compression
Answer: B — Images are the largest contributor to page weight on most websites.

Q234. What is a Content Delivery Network (CDN)?
A) Content creator network B) A geographically distributed network of servers caching static assets closer to users, reducing latency and server load C) A cloud service D) A caching strategy
Answer: B — CDNs are essential for serving static assets (JS, CSS, images) at global scale.

Q235. What is HTTP/2 and how does it improve performance?
A) A newer HTTP B) HTTP version 2 enabling request multiplexing (multiple requests over one connection), header compression, and server push — eliminating HTTP/1.1 head-of-line blocking C) A CDN feature D) A caching protocol
Answer: B — HTTP/2 makes the old "bundle everything" approach less necessary.

### Fill in the Blank

Q236. ________ is the performance technique preloading resources that will be needed soon using `<link rel="preload">`.
Answer: Resource preloading

Q237. ________ is a browser rendering optimization where elements are painted on separate GPU layers, enabling efficient compositing.
Answer: Compositing (GPU layers — triggered by transform, opacity, will-change)

Q238. ________ is the technique splitting a long synchronous task into smaller chunks yielding to the browser between each chunk.
Answer: Task chunking (or yielding with scheduler.yield() / setTimeout)

Q239. ________ is a build optimization removing console.log statements and comments from production JavaScript bundles.
Answer: Minification (using Terser or similar)

Q240. ________ is a React-specific performance optimization rendering only the visible items in a large list, recycling DOM nodes as the user scrolls.
Answer: Virtual scrolling (windowing — react-window, react-virtual)

Q241. ________ is the browser's ability to hint which DNS lookups to perform early using `<link rel="dns-prefetch">`.
Answer: DNS prefetching

Q242. ________ is a performance metric measuring the time from when a user inputs a character to when it appears on screen.
Answer: Input latency (or INP — Interaction to Next Paint)

Q243. ________ is a build tool feature analyzing bundle composition to identify large dependencies.
Answer: Bundle analysis (webpack-bundle-analyzer, vite-bundle-visualizer)

Q244. ________ is the practice of inlining critical CSS required to render above-the-fold content directly in the HTML head.
Answer: Critical CSS inlining

Q245. ________ is a browser API for measuring performance of specific operations: navigation, resource loading, and custom user marks.
Answer: Performance API (performance.mark(), performance.measure())

---

## TOPIC 14: BUILD TOOLS AND MODULE BUNDLERS

### Concept MCQ

Q246. What is webpack?
A) A web packaging tool B) A static module bundler for JavaScript applications — takes a dependency graph from entry points and outputs optimized bundles C) A task runner D) A transpiler
Answer: B — webpack is highly configurable and powers most large enterprise frontend builds.

Q247. What is Vite?
A) A French word B) A modern build tool using ES modules for lightning-fast development server startup and HMR, with Rollup-based production builds C) A webpack plugin D) A CSS processor
Answer: B — Vite is now the recommended build tool for new projects with React, Vue, and Svelte.

Q248. What is Babel?
A) A language B) A JavaScript compiler (transpiler) converting modern JavaScript (ES2015+) to backward-compatible versions for older browsers C) A build tool D) A linter
Answer: B — Babel also processes JSX into `React.createElement()` calls.

Q249. What is ESLint?
A) A JavaScript version B) A static analysis tool identifying and fixing problems in JavaScript code — style violations, potential bugs, and best practice violations C) A formatter D) A compiler
Answer: B — Configure rules in `.eslintrc` and integrate into CI/CD for code quality gates.

Q250. What is Prettier?
A) A beautifier B) An opinionated code formatter enforcing consistent code style automatically — removes style debates from code review C) A linter D) A compiler
Answer: B — Prettier formats; ESLint lints. They complement each other.

Q251. What is Hot Module Replacement (HMR)?
A) A deployment feature B) A development feature replacing modules in a running application without full page reload — preserving application state while reflecting code changes instantly C) A build optimization D) A caching feature
Answer: B — HMR dramatically improves development experience especially in large applications.

Q252. What is a source map?
A) A site map B) A file mapping compiled/minified code back to original source code, enabling debugging of production code in browser DevTools C) A code map D) A dependency map
Answer: B — Source maps end with `.map` and are referenced at the bottom of bundles.

Q253. What is the difference between development and production builds?
A) No difference B) Development: unminified, source maps, HMR, verbose errors. Production: minified, tree-shaken, optimized, no source maps (or external), dead code removed C) Production is faster D) Development has features removed
Answer: B — Never deploy development builds to production.

Q254. What is PostCSS?
A) After CSS B) A tool transforming CSS with JavaScript plugins — enabling Autoprefixer, CSS variables, nesting, and custom transforms C) A CSS preprocessor D) A CSS framework
Answer: B — PostCSS processes CSS through a plugin pipeline; it is not a preprocessor itself.

Q255. What is a monorepo?
A) A single program B) A single repository containing multiple related packages/applications, enabling code sharing, consistent tooling, and coordinated changes across projects C) A large app D) A Git strategy
Answer: B — Tools: Nx, Turborepo, Lerna, pnpm workspaces.

### Fill in the Blank

Q256. ________ is a webpack concept defining the starting point from which the dependency graph is built.
Answer: Entry point

Q257. ________ is a webpack plugin specifically optimizing and compressing images during the build process.
Answer: image-minimizer-webpack-plugin

Q258. ________ is a build configuration enabling multiple applications or micro-frontends to share code at runtime rather than bundling it.
Answer: Module Federation (webpack Module Federation)

Q259. ________ is the tool managing JavaScript project dependencies defined in package.json.
Answer: npm (or yarn, pnpm)

Q260. ________ is a configuration file telling package managers and bundlers which fields to use for different module formats.
Answer: package.json exports field (or main/module/browser fields)

---

## TOPIC 15: TESTING

### Concept MCQ

Q261. What is unit testing in frontend development?
A) Testing server units B) Testing individual functions, components, or modules in isolation — verifying their behavior given controlled inputs C) Integration testing D) E2E testing
Answer: B — Jest and Vitest are the primary unit testing frameworks for frontend.

Q262. What is integration testing in frontend?
A) Testing APIs B) Testing how multiple components or modules work together — verifying interactions between components, hooks, and services C) Unit testing D) E2E testing
Answer: B — React Testing Library is the standard for component integration testing.

Q263. What is end-to-end (E2E) testing?
A) Frontend to backend testing B) Testing complete user flows in a real or headless browser — simulating real user interactions across the entire application C) Integration testing D) Visual testing
Answer: B — Playwright and Cypress are the primary E2E testing tools.

Q264. What is the Testing Library philosophy?
A) Testing implementation B) Testing the way users interact with the application — querying elements by accessible role, label, or text rather than by class names or implementation details C) Testing components D) Testing APIs
Answer: B — "The more your tests resemble the way your software is used, the more confidence they give."

Q265. What is snapshot testing?
A) Screenshot testing B) Serializing a component's rendered output to a file and comparing future renders to the snapshot — failing if the output changes unexpectedly C) Unit testing D) Visual regression
Answer: B — Useful for catching unexpected UI changes but can become brittle and give false confidence.

Q266. What is Test-Driven Development (TDD)?
A) Writing tests after code B) Writing failing tests first, then writing minimum code to pass them, then refactoring — Red, Green, Refactor cycle C) A testing tool D) A testing framework
Answer: B — TDD encourages better API design and higher test coverage.

Q267. What is mocking in testing?
A) Making fun of code B) Replacing real dependencies with controlled fake implementations — enabling isolated testing without network calls, database access, or third-party services C) Stubbing D) Spying
Answer: B — Jest.fn(), jest.mock(), and MSW (Mock Service Worker) are common mocking tools.

Q268. What is Mock Service Worker (MSW)?
A) A web worker B) A tool intercepting network requests at the service worker level and returning mock responses — enabling realistic API mocking in both tests and development C) A Jest mock D) A network proxy
Answer: B — MSW works identically in test environments and browsers without code changes.

Q269. What is Playwright?
A) A drama tool B) A cross-browser E2E testing framework by Microsoft supporting Chromium, Firefox, and WebKit — with auto-waiting, multi-tab support, and visual comparisons C) A unit testing tool D) A React testing tool
Answer: B — Playwright has largely superseded Cypress for new projects.

Q270. What is code coverage?
A) Comments in code B) A metric measuring the percentage of code lines, branches, functions, and statements executed during testing C) Test quality D) Test count
Answer: B — 100% coverage does not mean the tests are good — quality of assertions matters more than coverage percentage.

### Fill in the Blank

Q271. ________ is a Jest/Vitest method creating a mock function that records calls and enables assertions on how it was called.
Answer: jest.fn() (or vi.fn() in Vitest)

Q272. ________ is a React Testing Library query finding elements by their ARIA role — the most accessible and recommended query method.
Answer: getByRole()

Q273. ________ is the Jest lifecycle method running setup code before each test in a file.
Answer: beforeEach()

Q274. ________ is a testing pattern where the test confirms a Promise rejects with a specific error.
Answer: await expect(promise).rejects.toThrow()

Q275. ________ is a Playwright feature automatically waiting for elements to be ready before interacting, eliminating manual await/sleep.
Answer: Auto-waiting

---

## TOPIC 16: ACCESSIBILITY (A11Y)

### Concept MCQ

Q276. What is web accessibility?
A) Fast loading websites B) Designing and developing websites usable by people with disabilities — visual, hearing, motor, and cognitive — following WCAG guidelines C) Mobile compatibility D) SEO optimization
Answer: B — Approximately 15-20% of the population has some form of disability.

Q277. What are WCAG guidelines?
A) Web design guidelines B) Web Content Accessibility Guidelines — the international standard for web accessibility, organized into four principles: Perceivable, Operable, Understandable, Robust (POUR) C) A CSS standard D) A testing framework
Answer: B — WCAG 2.1 AA is the most commonly required compliance level.

Q278. What is keyboard accessibility?
A) Keyboard shortcuts B) Ensuring all interactive functionality is operable using only a keyboard — critical for users with motor disabilities who cannot use a mouse C) Tab navigation D) Both B and C
Answer: D — All interactive elements must be focusable and operable via keyboard.

Q279. What is focus management?
A) Concentration techniques B) Controlling where keyboard focus goes in an application — moving focus to modals when opened, returning focus when closed, ensuring focus is not trapped C) Tab order D) Focus styles
Answer: B — Poor focus management makes applications unusable for keyboard and screen reader users.

Q280. What is a skip link?
A) A removed link B) A hidden-until-focused link at the top of a page allowing keyboard users to skip repetitive navigation and jump directly to main content C) An anchor link D) A hash link
Answer: B — `<a href="#main-content" class="skip-link">Skip to main content</a>` — visible on focus.

Q281. What is color contrast ratio?
A) A color metric B) The ratio of luminance between foreground and background colors — WCAG AA requires 4.5:1 for normal text, 3:1 for large text C) A design choice D) A browser feature
Answer: B — Use tools like WebAIM Contrast Checker to verify color contrast.

Q282. What is the difference between `aria-label` and `aria-labelledby`?
A) No difference B) `aria-label` provides a string label directly; `aria-labelledby` references the ID of another element whose text serves as the label — prefer visible text with aria-labelledby C) aria-label is deprecated D) aria-labelledby is for forms only
Answer: B — Visible labels with aria-labelledby are generally preferred over invisible aria-label.

Q283. What is `role="presentation"` used for?
A) Giving an element a role B) Removing semantic meaning from an element (and its children) so screen readers ignore its role — useful for layout tables and decorative elements C) A CSS role D) An ARIA landmark
Answer: B — `role="none"` is the newer equivalent.

Q284. What is a screen reader?
A) A display tool B) Assistive technology converting digital text to speech or braille output, enabling blind and visually impaired users to navigate and use websites C) A browser plugin D) A magnifier
Answer: B — NVDA (Windows), JAWS (Windows), VoiceOver (Mac/iOS), TalkBack (Android) are major screen readers.

Q285. What is an accessibility tree?
A) A DOM element B) A representation of the page built from the DOM that assistive technologies use — containing the accessible name, role, state, and value of each interactive element C) A component tree D) A DOM tree variant
Answer: B — Chrome DevTools' Accessibility panel shows the accessibility tree for any element.

### Fill in the Blank

Q286. ________ is an ARIA attribute indicating an element is currently active in a set of items — navigation links, tabs.
Answer: aria-current

Q287. ________ is the minimum size recommended by WCAG for touch targets on mobile devices.
Answer: 44×44 CSS pixels (WCAG 2.5.5)

Q288. ________ is an HTML technique grouping related form controls with a visual and semantic label.
Answer: `<fieldset>` with `<legend>`

Q289. ________ is the WCAG principle that UI components must be operable — all functionality available from a keyboard.
Answer: Operable (POUR)

Q290. ________ is a tool for auditing web accessibility built into Chrome DevTools.
Answer: Lighthouse (or axe DevTools, WAVE)

---

## TOPIC 17: SECURITY IN FRONTEND

### Concept MCQ

Q291. What is Cross-Site Scripting (XSS) in the frontend context?
A) CSS attacks B) Injecting malicious scripts into web pages viewed by other users — can steal cookies, tokens, redirect users, or manipulate the DOM C) A network attack D) SQL injection
Answer: B — Prevent by encoding output, using CSP headers, and avoiding innerHTML with user data.

Q292. What is Content Security Policy (CSP)?
A) A privacy policy B) An HTTP response header specifying which content sources the browser may load — blocking inline scripts and unauthorized external scripts to mitigate XSS C) A cookie policy D) A CORS header
Answer: B — `Content-Security-Policy: default-src 'self'; script-src 'self' trusted.cdn.com`.

Q293. What is CORS?
A) A CSS framework B) Cross-Origin Resource Sharing — a browser security mechanism allowing or restricting cross-origin HTTP requests using HTTP headers C) A security attack D) A cookie mechanism
Answer: B — The browser enforces CORS; the server controls it with `Access-Control-Allow-Origin` headers.

Q294. What is the Same-Origin Policy?
A) Using the same origin B) A browser security rule preventing JavaScript on one origin from accessing resources on another origin unless explicitly permitted by CORS C) A CORS rule D) A cookie rule
Answer: B — Origins are same if protocol, domain, and port all match.

Q295. What is clickjacking?
A) Button clicking B) Tricking users into clicking on invisible iframe elements overlaid on legitimate content — defended with `X-Frame-Options` or CSP `frame-ancestors` header C) A form attack D) An XSS variant
Answer: B — `X-Frame-Options: DENY` prevents any site from embedding your page in an iframe.

Q296. What is Subresource Integrity (SRI)?
A) Asset loading B) A security feature verifying that CDN-hosted resources have not been tampered with, using a cryptographic hash in the `integrity` attribute of script and link tags C) A CDN feature D) A cache feature
Answer: B — `<script src="..." integrity="sha384-..." crossorigin="anonymous">`.

Q297. What are HttpOnly and Secure cookie flags in the frontend context?
A) Cookie settings B) HttpOnly prevents JavaScript from accessing the cookie (mitigating XSS token theft); Secure ensures cookies are only sent over HTTPS C) HTTP headers D) Cookie types
Answer: B — Authentication cookies should always have both HttpOnly and Secure flags set.

Q298. What is CSRF (Cross-Site Request Forgery) protection in SPAs?
A) A server concern only B) SPAs typically use token-based authentication (JWT in memory or localStorage) rather than cookies — making them less vulnerable to CSRF. If using cookies, implement anti-CSRF tokens C) Not needed D) A routing issue
Answer: B — JWTs in headers cannot be sent by third-party sites. Cookies without SameSite can be.

### Fill in the Blank

Q299. ________ is the browser mechanism that adds a Referer-like header with requests, helping servers verify the origin of cross-site requests.
Answer: Origin header (or SameSite cookie attribute)

Q300. ________ is a security technique storing authentication tokens in memory rather than localStorage to prevent XSS-based token theft.
Answer: In-memory token storage (with refresh token in HttpOnly cookie)

---

## TOPIC 18: NEXT.JS AND MODERN FRAMEWORKS

### Concept MCQ

Q301. What is Next.js?
A) The next JavaScript version B) A React framework providing server-side rendering, static site generation, API routes, file-based routing, and built-in optimization C) A React competitor D) A build tool
Answer: B — Next.js is the most widely adopted React framework for production applications.

Q302. What is Server-Side Rendering (SSR)?
A) Server-only code B) Generating HTML on the server for each request — the browser receives a fully rendered page, improving SEO and initial load performance C) Static generation D) Client rendering
Answer: B — In Next.js: `getServerSideProps` (Pages Router) or async Server Components (App Router).

Q303. What is Static Site Generation (SSG)?
A) Hand-coded HTML B) Pre-generating HTML at build time — pages are served as static files from a CDN, providing maximum performance and scalability C) Server rendering D) Client rendering
Answer: B — In Next.js: `getStaticProps` (Pages Router) or default Server Components without dynamic data (App Router).

Q304. What is Incremental Static Regeneration (ISR)?
A) Slow regeneration B) Next.js feature updating static pages after deployment by revalidating them on a schedule or on demand — combining SSG performance with fresh data C) An SSR variant D) A CDN feature
Answer: B — `revalidate: 60` in getStaticProps regenerates the page every 60 seconds.

Q305. What is the App Router in Next.js 13+?
A) A routing library B) The new Next.js routing system based on the app directory — introducing React Server Components, nested layouts, streaming, and server actions as the default C) A React Router variant D) A file system
Answer: B — App Router uses React Server Components by default; add `'use client'` for client-side interactivity.

Q306. What is a React Server Component (RSC)?
A) A server utility B) A component that renders on the server and sends HTML to the client — zero JavaScript bundle contribution, direct database/filesystem access, but no interactivity or hooks C) A server template D) An SSR page
Answer: B — RSCs reduce client bundle size and enable server-only data access patterns.

Q307. What is the difference between Server Components and Client Components in Next.js?
A) No difference B) Server Components render on server, access server resources, have zero client JS; Client Components render on client (or hydrate), can use hooks, event handlers, and browser APIs C) Client Components are faster D) Server Components are new React
Answer: B — Add `'use client'` at the top of a file to make it a Client Component.

Q308. What is streaming in Next.js?
A) Video streaming B) Progressively sending chunks of rendered HTML from the server to the browser as they are ready — wrapping slow components in Suspense enables streaming C) A data fetching method D) An optimization
Answer: B — Streaming enables a fast initial response even when some components need time to render.

Q309. What is middleware in Next.js?
A) npm packages B) Code running before a request is processed — used for authentication, redirects, A/B testing, and geolocation-based routing at the edge C) API routes D) Server functions
Answer: B — Next.js Middleware runs on the Edge Runtime for ultra-low latency.

Q310. What are Server Actions in Next.js?
A) API routes B) Functions marked with `'use server'` running on the server when called from client components — enabling form mutations and data updates without manual API routes C) Server utilities D) API functions
Answer: B — Server Actions simplify the client-server data mutation pattern significantly.

### Fill in the Blank

Q311. ________ is the Next.js file that wraps all pages, persisting state and layouts across navigations.
Answer: _app.js (Pages Router) or layout.tsx (App Router)

Q312. ________ is the Next.js component for optimized image delivery with lazy loading, WebP conversion, and layout shift prevention.
Answer: next/image (Image component)

Q313. ________ is the Next.js component for optimizing font loading, preventing layout shift, and self-hosting Google Fonts.
Answer: next/font

Q314. ________ is the Next.js file creating a custom 404 error page.
Answer: 404.tsx (or not-found.tsx in App Router)

Q315. ________ is the Next.js App Router file showing a loading skeleton while a route segment loads.
Answer: loading.tsx (Suspense boundary)

---

## TOPIC 19: PROGRESSIVE WEB APPS AND WEB APIs

### Concept MCQ

Q316. What is a Progressive Web App (PWA)?
A) A mobile app B) A web application using modern browser capabilities to deliver app-like experiences — installable, offline support, push notifications, background sync C) A native app D) A React app
Answer: B — PWAs use service workers, Web App Manifest, and HTTPS.

Q317. What is a Web App Manifest?
A) A webpack config B) A JSON file providing metadata about the PWA — name, icons, start URL, display mode, theme color — enabling the browser to install the app C) A service worker D) A configuration file
Answer: B — `<link rel="manifest" href="/manifest.json">` in the HTML head.

Q318. What are offline-first strategies?
A) No internet needed B) Service worker caching strategies ensuring apps work without a network connection — Cache First, Network First, Stale While Revalidate C) Server strategies D) CDN strategies
Answer: B — Cache First: serve cache, fall back to network. Network First: try network, fall back to cache.

Q319. What is the Push API?
A) Git push B) A browser API enabling servers to send messages to a web application even when it is not open, implemented via service workers C) A notification API D) A web socket
Answer: B — Combined with the Notifications API for push notification support.

Q320. What is Background Sync?
A) Background data syncing B) A service worker API deferring actions until the user has stable connectivity — ensuring form submissions and data updates are not lost when offline C) Background fetch D) A PWA feature
Answer: B — `registration.sync.register('send-messages')` queues the sync event.

### Fill in the Blank

Q321. ________ is the PWA display mode making the app look like a native app with no browser UI.
Answer: standalone (display: "standalone" in manifest)

Q322. ________ is a service worker event firing when the browser wants to cache resources for the first time.
Answer: install event

Q323. ________ is a service worker event firing when the worker takes control of the page.
Answer: activate event

Q324. ________ is the Workbox library strategy caching responses and serving them while revalidating in the background.
Answer: StaleWhileRevalidate

Q325. ________ is the minimum security requirement for service workers to function.
Answer: HTTPS (or localhost for development)

---

## TOPIC 20: ADVANCED FRONTEND TOPICS

### Concept MCQ

Q326. What is micro-frontend architecture?
A) Small frontends B) Decomposing a frontend application into independent, deployable units developed by different teams — each owning their own technology stack and deployment cycle C) Small components D) A module pattern
Answer: B — Implemented using Module Federation, iframes, web components, or routing-based composition.

Q327. What is Web Components?
A) React components B) A suite of browser standards (Custom Elements, Shadow DOM, HTML Templates) enabling framework-agnostic, encapsulated, reusable components C) Angular components D) Native components
Answer: B — Web Components work in any framework or vanilla HTML.

Q328. What is Shadow DOM?
A) A hidden DOM B) A scoped, encapsulated DOM tree attached to an element — its styles and script are isolated from the main document, preventing conflicts C) A virtual DOM D) A component DOM
Answer: B — Used internally by browser built-in elements (video, input) and by Web Components.

Q329. What is CSS-in-JS?
A) CSS in JavaScript files B) A pattern defining CSS styles in JavaScript, enabling dynamic styling, component scoping, and theme composition — styled-components, Emotion, Stitches C) Inline styles D) CSS modules
Answer: B — CSS-in-JS trades static CSS extraction for dynamic styling capabilities.

Q330. What is CSS Modules?
A) CSS imports B) A build-time approach automatically scoping CSS class names to the component using them — prevents naming collisions without runtime overhead C) CSS-in-JS D) Global CSS
Answer: B — `import styles from './Button.module.css'` — `styles.button` generates a unique class name.

Q331. What is atomic CSS?
A) CSS for atoms B) A utility-first CSS methodology generating single-purpose utility classes — Tailwind CSS is the dominant implementation C) A CSS preprocessor D) A CSS framework
Answer: B — Atomic CSS maximizes reuse by composing utilities rather than writing custom CSS.

Q332. What is Tailwind CSS?
A) A CSS preprocessor B) A utility-first CSS framework providing pre-built utility classes enabling rapid UI construction without leaving HTML — with PurgeCSS removing unused styles C) A CSS framework D) A design system
Answer: B — Tailwind has achieved massive adoption in modern frontend development.

Q333. What is a design system?
A) A design process B) A collection of reusable components, design tokens, documentation, and guidelines ensuring consistent UI across an organization's products C) A pattern library D) A UI framework
Answer: B — Examples: Material Design (Google), Ant Design, Chakra UI, Radix UI.

Q334. What is Storybook?
A) A book platform B) A tool for developing and testing UI components in isolation — providing a visual catalogue of components with interactive controls C) A testing framework D) A design tool
Answer: B — Storybook is the standard tool for component-driven development.

Q335. What is Headless UI?
A) No UI B) Unstyled, accessible UI component libraries providing behavior and accessibility without visual styles — developers apply their own styles C) A CMS D) A component library
Answer: B — Radix UI, Headless UI (by Tailwind), and Ark UI are popular headless libraries.

### Fill in the Blank

Q336. ________ is a Next.js and React pattern co-locating data fetching with the component that uses the data, eliminating data-fetching waterfalls.
Answer: Collocated data fetching (or component-level fetching in RSC)

Q337. ________ is a CSS feature enabling container-based responsive design — styling components based on their own size rather than the viewport.
Answer: Container queries (@container)

Q338. ________ is a web standard enabling smooth transitions between pages including persistent elements.
Answer: View Transitions API

Q339. ________ is a CSS feature allowing gradual typography enhancement across a variable range.
Answer: Variable fonts (@font-face with font-variation-settings)

Q340. ________ is an architectural pattern rendering static HTML with JavaScript hydration added progressively.
Answer: Islands Architecture (used in Astro, Fresh)

---

## TOPIC 21: INTERVIEW SCENARIOS — ADVANCED FRONTEND

Q341. You notice your Next.js app's Time to First Byte (TTFB) is consistently over 2 seconds. How do you diagnose and fix it?
Answer: TTFB measures server response time. Diagnose: use Chrome DevTools Network tab filtering for the HTML document — check waiting time. Use WebPageTest for server-side timing breakdown. Causes and fixes: database queries in getServerSideProps — add caching (Redis), optimize queries, use database connection pooling. Server compute: move heavy processing to build time (SSG/ISR) or a background job. No caching: add Cache-Control headers, use edge caching (Vercel/Cloudflare CDN). Server cold starts: if using serverless functions, implement warm-up strategies. Geographic distance: deploy to edge locations closer to users. If data does not change per request, switch from SSR to ISR or SSG entirely — often the best fix.

Q342. A React application has a laggy input field when a user types in it. How do you diagnose and fix this?
Answer: Input lag means the main thread is blocked during keystroke processing. Diagnose: open Chrome DevTools Performance tab, record while typing, identify long tasks (> 50ms) blocking the main thread. Common causes: expensive re-renders triggered by state updates on every keystroke — the entire parent tree is re-rendering. Fixes: ensure only the input component re-renders (move state down, use React.memo on siblings). Debounce expensive operations triggered by input (search queries, validation) but not the input value itself. Use `useTransition` to mark non-urgent state updates as transitions, keeping the input responsive. Move heavy computation to a Web Worker. Avoid layout-triggering DOM reads in event handlers. Fix CSS: complex box-shadow or filter animations on the input itself can cause GPU layer thrashing.

Q343. How would you implement infinite scroll in React without causing performance issues?
Answer: Implementation: use IntersectionObserver to detect when a sentinel element at the bottom of the list comes into view, triggering a data fetch. Update state by appending new items to the existing array. Performance: use virtual scrolling (react-virtual or react-window) to render only visible items — without virtualization, thousands of DOM nodes will slow the browser. Only render items that are currently visible plus a buffer. Memory management: implement a maximum item cap and remove items from the top as new ones are added at the bottom (if memory is a concern). Loading state: show a skeleton or spinner in the sentinel area while fetching. Error handling: show a retry button if the fetch fails. Accessibility: announce to screen readers when new content loads. Use URL-based pagination as an alternative when SEO or shareability of scroll position is needed.

Q344. You need to share state between two sibling components that are far apart in the component tree. What approaches do you consider?
Answer: Options in order of increasing complexity: Lift state up to the nearest common ancestor — appropriate if the ancestor is close. React Context API — appropriate for relatively stable data (theme, user, locale). External state management (Zustand, Redux) — appropriate for complex state with many updates. URL state — for state that should be shareable and bookmarkable (filters, tabs, selected items). Consider the access pattern: if many components read it but few write, Context is fine. If many components write with high frequency, Context's re-render behavior will cause issues — use Zustand or split context into multiple smaller contexts. Prefer lifting state before reaching for external libraries — often the tree is not as deep as it seems.

Q345. A client asks you to make their existing server-rendered multi-page application work offline. What is your approach?
Answer: Progressive enhancement strategy. Add a service worker via Workbox. Implement a cache strategy: Cache-First for static assets (CSS, JS, images, fonts) — these change rarely and serving stale is acceptable. Network-First for HTML pages — users expect fresh content but fall back to cache when offline. Stale-While-Revalidate for semi-dynamic content. Add a Web App Manifest for installability. Create a custom offline page for uncached routes, explaining to users they are offline and which pages are available cached. Use Background Sync for form submissions that occur while offline — queue them and submit when connectivity returns. Test with Chrome DevTools offline mode and throttled connections. Measure impact with Lighthouse PWA audit.

---

## TOPIC 22: FILL IN THE BLANK — MIXED ADVANCED

Q346. ________ is a CSS pseudo-class matching elements when they are being activated by the user — mouse click or touch.
Answer: :active

Q347. ________ is the JavaScript method creating an exact copy of an object including non-enumerable properties and prototype.
Answer: Object.create() (for prototype copying) — structuredClone() for data deep copy

Q348. ________ is a React pattern for running effects that need to clean up subscriptions or async operations.
Answer: useEffect cleanup (returning a cleanup function)

Q349. ________ is the event that fires when a user's pointer enters an element — including when moving from a child element.
Answer: mouseover (vs mouseenter which does not bubble)

Q350. ________ is a CSS property making an element responsive to pointer events — setting none disables all mouse interactions.
Answer: pointer-events

Q351. ________ is an HTML attribute forcing a download dialog instead of navigating to a URL.
Answer: download attribute on `<a>`

Q352. ________ is a JavaScript API for creating and managing custom browser notifications.
Answer: Notifications API

Q353. ________ is a browser API for reading and writing to the system clipboard.
Answer: Clipboard API (navigator.clipboard)

Q354. ________ is a CSS function enabling smooth value interpolation between a minimum and maximum based on viewport size.
Answer: clamp()

Q355. ________ is the JavaScript method checking if all elements in an array pass a test function.
Answer: Array.prototype.every()

Q356. ________ is a React 18 feature batching multiple state updates together including those inside setTimeout and native event handlers.
Answer: Automatic batching

Q357. ________ is a web standard encoding binary data as text using 64 characters.
Answer: Base64 (btoa() and atob() in browsers)

Q358. ________ is the CSS property preventing text from wrapping to a new line.
Answer: white-space: nowrap

Q359. ________ is a JavaScript method converting a NodeList or HTMLCollection to a regular Array.
Answer: Array.from() (or spread [...nodeList])

Q360. ________ is a CSS feature enabling smooth scrolling behavior when navigating to anchor links.
Answer: scroll-behavior: smooth (or CSS scroll-behavior on html element)

Q361. ________ is the React prop passing children JSX to a component.
Answer: children prop

Q362. ________ is a TypeScript utility type making all properties of a type optional.
Answer: Partial<T>

Q363. ________ is the CSS selector matching an element only if it does not match the selector argument.
Answer: :not()

Q364. ________ is a JavaScript pattern for implementing observable streams of events.
Answer: RxJS (Observables)

Q365. ________ is the CSS property controlling the animation timing function curve.
Answer: animation-timing-function (or transition-timing-function)

Q366. ________ is a build tool plugin automatically adding vendor prefixes to CSS properties.
Answer: Autoprefixer (PostCSS plugin)

Q367. ________ is the HTTP header controlling how browsers cache a response.
Answer: Cache-Control

Q368. ________ is a CSS at-rule defining custom font faces for use in the document.
Answer: @font-face

Q369. ________ is the React hook reading a value from Context without prop drilling.
Answer: useContext

Q370. ________ is the browser API for smooth programmatic scrolling to elements or positions.
Answer: element.scrollIntoView() (or window.scrollTo() with behavior: 'smooth')

Q371. ________ is a JavaScript technique creating private module state using closures and returning only a public API.
Answer: Module pattern (IIFE or ES module encapsulation)

Q372. ________ is a CSS property enabling smooth interpolation of layout changes.
Answer: transition (or CSS Transitions)

Q373. ________ is the Next.js hook reading the current URL's query parameters and pathname.
Answer: useSearchParams (App Router) or useRouter (Pages Router)

Q374. ________ is a technique reducing perceived load time by showing placeholder shapes in the layout of expected content.
Answer: Skeleton screens (or content placeholders)

Q375. ________ is the CSS property enabling 3D perspective on transformed child elements.
Answer: perspective

Q376. ________ is a React pattern providing a default value when a component is rendered outside of its context provider.
Answer: Context default value (second argument to createContext)

Q377. ________ is the JavaScript event firing just before the browser unloads the page.
Answer: beforeunload

Q378. ________ is a CSS feature enabling native smooth scrolling snapping of scroll containers.
Answer: CSS Scroll Snap (scroll-snap-type, scroll-snap-align)

Q379. ________ is the technique splitting vendor dependencies into a separate bundle to improve caching.
Answer: Vendor chunk splitting (splitChunks in webpack, manualChunks in Vite)

Q380. ________ is a CSS property enabling elements to become sticky within their scroll parent.
Answer: position: sticky

---

## TOPIC 23: SCENARIO QUESTIONS — INTERMEDIATE

Q381. How would you implement a modal dialog that is fully accessible?
Answer: HTML structure: use a `<dialog>` element (native HTML5) or a div with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the modal title. Focus management: when the modal opens, move focus to the first focusable element or the modal container itself. Trap focus within the modal — users must not be able to tab outside. Return focus to the trigger element when the modal closes. Keyboard: close on Escape key. Scroll lock: prevent background scrolling while modal is open by adding `overflow: hidden` to body. Screen reader: use `aria-hidden="true"` on the background content when the modal is open, preventing screen readers from reading it. Close button: a clearly labeled close button accessible by keyboard. Animation: use `prefers-reduced-motion` media query to disable animations for users who prefer it.

Q382. You need to implement a search-as-you-type feature. How do you ensure good performance and user experience?
Answer: Debounce the search input (300ms) to avoid firing an API call on every keystroke. Show a loading indicator after debounce fires so users know a search is in progress. Implement optimistic UI — show previous results until new ones arrive. Handle race conditions: tag each request with a timestamp or use AbortController to cancel previous in-flight requests before making a new one. Keyboard navigation: allow arrow keys to navigate the suggestions list, Enter to select, Escape to close. Screen reader: use `role="combobox"`, `aria-autocomplete`, `aria-controls`, and `aria-activedescendant` for the input. Mark matching characters in suggestions. Implement a minimum character threshold (2-3 chars) before searching. Cache results with React Query or SWR to avoid repeated API calls for the same query.

Q383. How would you approach building a data table component with sorting, filtering, and pagination?
Answer: Component design: separate concerns — useSortedData hook, useFilteredData hook, usePaginatedData hook. Sorting: maintain sort state (column, direction), apply sorting to the data array, use `aria-sort` on column headers (ascending/descending/none). Filtering: debounce filter input, apply to all relevant columns, show result count. Pagination: calculate total pages, provide keyboard-accessible previous/next buttons, show current range. Performance: for large datasets (> 1000 rows) use virtual scrolling. Accessibility: use proper `<table>`, `<thead>`, `<tbody>`, `<th scope="col">` elements, not div-based layouts. Column resizing: add resize handles with proper cursor and ARIA. Consider TanStack Table (formerly React Table) for a headless, composable solution handling all these concerns with proper TypeScript support.

Q384. A developer on your team creates a React component that makes an API call in the render function body (not in useEffect). What is the problem and how do you fix it?
Answer: Critical bug. Making side effects in the render body causes the API call to fire on every render — including re-renders triggered by parent state changes, causing infinite loops or excessive network requests. React renders may be called multiple times in development (StrictMode double-invokes), and the rendering phase should be pure. Fix: move the API call to useEffect with the appropriate dependency array. For data fetching in particular, use React Query or SWR which handle caching, deduplication, and the useEffect lifecycle correctly. Explain the rule: render must be a pure function of props and state — no side effects. Side effects belong in useEffect, event handlers, or data fetching libraries.

Q385. How do you ensure a React application remains performant as it grows to thousands of components?
Answer: Architecture: keep state as local as possible — global state causes wide re-renders. Split large contexts into smaller, focused ones. Code splitting: lazy load route components and heavy third-party libraries. Bundle analysis: regularly audit bundle size with webpack-bundle-analyzer. Memoization: use React.memo for pure components receiving stable props. Use useMemo for expensive computations. Use useCallback for stable event handler references passed to memoized children. Virtual scrolling: for any list with more than 50-100 items. Image optimization: lazy load images below the fold, use WebP format, appropriate sizes. Performance monitoring: instrument with Web Vitals, track LCP/INP/CLS in production. React DevTools Profiler: identify re-render hotspots during development. Avoid premature optimization — profile first, then fix specific bottlenecks.

---

## TOPIC 24: MORE FILL IN THE BLANK

Q386. ________ is a JavaScript method converting an iterable to an array — commonly used to convert NodeLists.
Answer: Array.from()

Q387. ________ is the CSS property enabling smooth, GPU-accelerated scrolling within a container.
Answer: overflow: auto with overscroll-behavior (or overflow: scroll)

Q388. ________ is the HTML element for displaying tabular data with semantic row and column structure.
Answer: `<table>` with `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`

Q389. ________ is a Next.js feature pre-rendering pages whose props depend on dynamic data, revalidating on a schedule.
Answer: Incremental Static Regeneration (ISR)

Q390. ________ is a JavaScript API creating new Worker threads for running scripts in parallel.
Answer: Worker API (new Worker('./worker.js'))

Q391. ________ is the CSS property determining how an element's overflow is handled in the block direction only.
Answer: overflow-y

Q392. ________ is a React hook for integrating with external non-React systems imperatively.
Answer: useImperativeHandle (with forwardRef)

Q393. ________ is a CSS feature allowing authors to hook into the browser's rendering lifecycle for JavaScript animations.
Answer: requestAnimationFrame()

Q394. ________ is the HTML5 API for drag and drop interactions.
Answer: HTML Drag and Drop API (draggable, dragstart, dragover, drop events)

Q395. ________ is a CSS rule applying styles only when the document is being printed.
Answer: @media print

Q396. ________ is a TypeScript feature inferring function parameter types from the function's implementation.
Answer: Type inference

Q397. ________ is the practice of preloading the next page's assets while the user is still on the current page.
Answer: Prefetching (link rel="prefetch" or Next.js Link prefetch)

Q398. ________ is an HTML element displaying text as inline code in a monospace font.
Answer: `<code>` (or `<kbd>` for keyboard input, `<samp>` for program output)

Q399. ________ is a React 18 feature enabling a transition between two UI states with animation, natively supported by the browser.
Answer: View Transitions API (integrated with startViewTransition)

Q400. ________ is the recommended tool for type-safe API calls, generating types from OpenAPI or tRPC schemas.
Answer: tRPC (for end-to-end TypeScript) or openapi-typescript

---

## TOPIC 25: ADDITIONAL SCENARIOS

Q401. How do you handle forms in React, including validation and submission?
Answer: Controlled components: manage form state with useState or useReducer, updating values via onChange handlers. Validation: use React Hook Form for performance (uncontrolled internally, minimal re-renders) with Zod or Yup for schema validation. Or build custom validation with error state managed alongside form values. UX patterns: validate on blur for initial feedback, validate on change after first submit attempt, show inline error messages below each field. Accessibility: associate errors with fields using aria-describedby, mark invalid fields with aria-invalid="true". Submission: disable submit button while submitting, handle errors from the server, show success feedback. File uploads: use FormData API. Complex forms: consider multi-step with progress indicator, save draft to localStorage. React Hook Form with Zod is the current best practice combining developer experience with performance.

Q402. How would you implement authentication flow in a Next.js application?
Answer: Use NextAuth.js (Auth.js) or Clerk for a complete solution. Manual implementation: login page POSTs credentials to a Next.js API route (or Server Action). Server validates credentials, creates a session. Store session: HttpOnly Secure cookie containing a JWT or session ID — never localStorage for sensitive auth tokens. Protected routes: Next.js Middleware checks the session cookie for each protected route — redirect to login if absent. Client-side: use a useUser or useSession hook reading from context or an API endpoint. Refresh tokens: short-lived access tokens (15min) refreshed silently using a long-lived HttpOnly refresh token. CSRF: use SameSite=Lax on cookies for most protection; add CSRF tokens for state-changing requests if SameSite=None is needed. OAuth: implement provider flows with proper state parameter for CSRF protection.

Q403. You are asked to implement a real-time collaborative feature (like Google Docs). What technology choices do you make?
Answer: WebSockets for bidirectional real-time communication — use socket.io for browser compatibility or native WebSocket API. Operational Transformation (OT) or CRDT (Conflict-free Replicated Data Types) for handling concurrent edits — Yjs is the leading CRDT library with React bindings. State synchronization: Yjs automatically merges concurrent operations without conflicts. Awareness: show other users' cursors and selections using Yjs Awareness protocol. Persistence: save document state to a database and load initial state when users join. Presence indicators: show who is currently viewing/editing. Offline support: buffer operations locally and sync when reconnected. Scaling: use a pub/sub system (Redis) to broadcast changes to all connected servers.

Q404. How do you approach internationalisation (i18n) in a React/Next.js application?
Answer: Library: next-intl or react-i18next for Next.js, i18next for generic React. Setup: extract all user-facing strings into JSON translation files per locale. Locale detection: detect from browser Accept-Language header, user preference, or URL path. URL structure: use path-based locales (/en/about, /fr/about) for SEO — Next.js has built-in i18n routing. Pluralization: use ICU message format for proper plural forms across languages. Date/number formatting: use Intl.DateTimeFormat and Intl.NumberFormat with the active locale — never hardcode date formats. RTL support: use CSS logical properties, `dir` attribute on html element, test with Arabic/Hebrew. Dynamic content: provide context strings for translators (what does this button do?). Testing: build a CI check that all strings in source files have translations in all supported locales.

Q405. A stakeholder wants to add a very complex data visualization to the application. How do you approach this?
Answer: Requirements gathering: what insights must the visualization communicate? Who is the audience? What interactions are needed? Library selection: D3.js for maximum flexibility and custom visualizations; Recharts or Victory for React-integrated chart components with good defaults; Chart.js for simpler use cases; Observable Plot for statistical visualizations. Performance: for large datasets (> 10k points), use canvas instead of SVG (D3 with canvas, WebGL for massive datasets). Virtualization: only render visible elements. Architecture: separate data transformation from rendering. Responsive: use ResizeObserver to react to container size changes, not just window resize. Accessibility: provide alt text, data tables as alternatives to visual charts, keyboard navigation for interactive elements. Progressive enhancement: show a meaningful view at every loading stage. Test on low-powered devices.

---

## TOPIC 26: MORE ADVANCED MCQ

Q406. What is the difference between `repaint` and `reflow` in browser rendering?
A) Same thing B) Reflow recalculates layout positions and sizes (expensive); repaint re-draws pixels without changing layout (less expensive) C) Reflow is faster D) Repaint causes reflow
Answer: B — Minimize both by batching DOM changes and avoiding layout-triggering properties in animations.

Q407. What is layout thrashing?
A) A browser bug B) Repeatedly forcing the browser to recalculate layout by alternating between reading layout properties and making DOM mutations in a loop C) A memory issue D) A CSS problem
Answer: B — Fix: batch reads separately from writes, or use requestAnimationFrame.

Q408. What is `requestAnimationFrame`?
A) A frame rate limiter B) A browser API scheduling a callback before the next screen repaint — enables smooth 60fps animations synchronized with the display refresh rate C) A timer D) An animation library
Answer: B — Always use rAF for JavaScript animations, never setTimeout/setInterval.

Q409. What is the paint worklet in CSS Houdini?
A) A painter tool B) A CSS Houdini API enabling JavaScript to programmatically draw CSS background images and borders with full GPU acceleration C) A CSS animation D) A canvas API
Answer: B — Houdini exposes the browser's CSS rendering engine for custom styling.

Q410. What is `content-visibility`?
A) A visibility property B) A CSS property enabling browsers to skip rendering of off-screen content entirely (layout, paint, compositing) until the content is near the viewport C) Lazy loading D) A display property
Answer: B — `content-visibility: auto` can dramatically improve initial render performance for long pages.

Q411. What is the Speculation Rules API?
A) A testing API B) A browser API enabling developers to declare which navigations to prerender or prefetch speculatively, enabling near-instant page transitions C) A cache API D) A prefetch API
Answer: B — More powerful than `<link rel="prefetch">` — can fully prerender the next page.

Q412. What is CSS Cascade Layers?
A) CSS z-index B) An `@layer` feature giving developers explicit control over the order of specificity layers — enabling framework styles to be overridden predictably C) A Sass feature D) CSS specificity
Answer: B — `@layer base, components, utilities` — higher layers win over lower ones regardless of specificity.

### Fill in the Blank

Q413. ________ is a browser performance API measuring long tasks (> 50ms) that block the main thread.
Answer: Long Tasks API (PerformanceObserver with 'longtask' type)

Q414. ________ is the React pattern rendering a component once with all data preloaded, then hydrating interactivity.
Answer: Selective hydration (or partial hydration)

Q415. ________ is a CSS feature applying different styles based on whether the user prefers reduced motion.
Answer: @media (prefers-reduced-motion: reduce)

Q416. ________ is a JavaScript technique converting synchronous iteration into asynchronous streams.
Answer: Async iterators (for await...of)

Q417. ________ is a Vite feature replacing module in-place in the browser without a full page reload during development.
Answer: Hot Module Replacement (HMR) via Vite's native ESM server

Q418. ________ is a browser feature natively compressing HTTP requests and responses using the Brotli algorithm.
Answer: Brotli compression (Content-Encoding: br)

Q419. ________ is a web performance technique preconnecting to origins the page will soon request resources from.
Answer: `<link rel="preconnect">` (or dns-prefetch for DNS only)

Q420. ________ is the CSS property that should be used for animations instead of `top/left` to avoid triggering layout.
Answer: transform (translate instead of top/left, scale instead of width/height)

---

## TOPIC 27: FINAL SCENARIOS

Q421. How would you implement a dark mode feature in a React application?
Answer: CSS approach: define a color palette using CSS custom properties on `:root` and override them with a `[data-theme="dark"]` attribute. Toggle: use a useTheme hook storing preference in localStorage and syncing with the `data-theme` attribute on the html element. System preference: use `window.matchMedia('(prefers-color-scheme: dark)')` to detect system preference as the initial default. Hydration: in Next.js, read the theme from a cookie in Server Components to avoid flash of incorrect theme during SSR. Tailwind: use the `dark:` variant with `darkMode: 'class'` configuration. Images: provide separate images for dark mode using `<picture>` with a `prefers-color-scheme` media query. SVGs: use `currentColor` so SVG icons adapt to text color. Testing: test both themes in Storybook.

Q422. How do you implement secure file upload in the frontend?
Answer: Validation before upload: check file type (MIME type and extension), file size limit, and number of files client-side. Never trust client-side validation alone — validate on the server too. Upload approach: for small files, base64 encode and include in JSON body. For large files, use multipart/form-data or — better — get a presigned URL from the server and upload directly to S3/GCS from the browser, avoiding server bandwidth costs. Progress: use XMLHttpRequest or fetch with ReadableStream for upload progress. Security: strip metadata from images server-side (EXIF data may contain GPS coordinates). Scan uploads with antivirus. Store files outside the web root or in cloud storage — never a public directory. Generate unpredictable file names to prevent guessing. Show preview for images using URL.createObjectURL() — always call URL.revokeObjectURL() after use to free memory.

Q423. Describe your approach to frontend error monitoring and debugging in production.
Answer: Error monitoring: integrate Sentry or Datadog frontend for automatic exception capture including stack traces, user context, and breadcrumbs. Source maps uploaded to Sentry (never public) for readable stack traces. Custom error boundaries in React catching and reporting component errors. Performance monitoring: Web Vitals (LCP, INP, CLS) reported via web-vitals library to your analytics or Sentry. Real User Monitoring (RUM): measure actual user experience in production. Logging: structured console logging in development that is stripped in production. Feature flags: use feature flags to gradually roll out changes and quickly disable problematic features. Debugging production: source maps accessible only to authenticated devs. Replay sessions with tools like Sentry Session Replay or LogRocket for understanding exactly what a user did before an error. Alerting: PagerDuty alerts for error rate spikes above threshold.

Q424. You are given a legacy jQuery application to modernize. What is your strategy?
Answer: Incremental modernization — do not attempt a full rewrite. Phase 1: Baseline. Add linting, testing, and build tooling without changing functionality. Document existing behavior. Phase 2: Extract utilities. Move jQuery utility functions to vanilla JS or lodash equivalents. Remove jQuery where it is being used just for simple DOM queries (document.querySelector replaces $). Phase 3: Componentize. Identify UI sections and convert them to framework components (React) incrementally. Use the Strangler Fig pattern — new features in React, old features in jQuery. Mount React components into existing jQuery page sections. Phase 4: State management. Replace global jQuery state with a proper state management solution. Phase 5: Full migration. Once most of the page is React components, remove jQuery entirely. Key principle: ship continuously, never have a feature freeze for a big bang rewrite.

Q425. How do you ensure code quality and consistency across a large frontend team?
Answer: Automated tooling: ESLint with shared config enforcing rules automatically. Prettier for consistent formatting — no style debates. TypeScript for type safety reducing entire classes of bugs. Husky pre-commit hooks running lint and type-check before every commit. CI/CD: run linting, type-checking, unit tests, and E2E tests on every pull request — block merges on failures. Code review: PR templates with checklists (accessibility, performance, tests, docs). Component documentation: Storybook as the source of truth for component usage. Design tokens: shared token system ensuring design consistency. Architecture decisions: ADRs (Architecture Decision Records) documenting why choices were made. Onboarding: thorough documentation of conventions, testing approaches, and component patterns. Regular team review: retrospectives on code quality issues, updating standards as the team learns.

---

## TOPIC 28: MORE FILL IN THE BLANK — FINAL

Q426. ________ is a React pattern where a component renders different content based on which child components are passed to it.
Answer: Compound components

Q427. ________ is the CSS property enabling elements to respond to pointer events even when covered by other elements.
Answer: pointer-events: none (on covering element)

Q428. ________ is a Next.js feature allowing data fetching to be colocated with the component and cached at multiple levels.
Answer: React Server Components with fetch caching

Q429. ________ is a JavaScript event emitted when a user pastes content from the clipboard.
Answer: paste event

Q430. ________ is a performance technique limiting the number of HTTP requests by combining multiple small images into one.
Answer: CSS sprites (or icon fonts, SVG sprites)

Q431. ________ is the CSS property controlling whether a flex container is the reference point for percentage-based flex-basis values.
Answer: flex-basis (with writing mode and cross-axis concepts)

Q432. ________ is a JavaScript API providing a single interface for network requests with support for streaming, cancellation, and credentials.
Answer: Fetch API

Q433. ________ is a technique ensuring a component's props type matches its implementation using TypeScript.
Answer: Props interface / type definition with TypeScript generics

Q434. ________ is a React testing approach asserting that after an action, a specific text appears in the document.
Answer: screen.findByText() (async) or getByText() (sync)

Q435. ________ is a HTML5 API detecting when a device's orientation or motion changes.
Answer: DeviceOrientation API

Q436. ________ is the CSS property making an element a scroll container with inertia-based scrolling on touch devices.
Answer: -webkit-overflow-scrolling: touch (legacy) or overflow: auto with overscroll-behavior

Q437. ________ is the CSS function returning the current color value of the element, enabling SVG and border color inheritance.
Answer: currentColor

Q438. ________ is a React pattern using array destructuring to return multiple values from a custom hook.
Answer: Tuple return pattern (const [value, setValue] = useCustomHook())

Q439. ________ is a browser API providing speech synthesis text-to-speech functionality.
Answer: SpeechSynthesis API

Q440. ________ is a CSS feature specifying whether CSS transitions or animations apply to an element.
Answer: will-change (combined with transform/opacity for GPU promotion)

Q441. ________ is the JavaScript specification for module loading in browsers using `<script type="module">`.
Answer: ES Modules (ESM)

Q442. ________ is a React pattern creating a component that handles errors in its subtree and renders a fallback UI.
Answer: Error Boundary (componentDidCatch + getDerivedStateFromError)

Q443. ________ is the web API for sharing content natively on mobile devices using the OS share sheet.
Answer: Web Share API (navigator.share())

Q444. ________ is a CSS property making all children of a grid or flex container maintain the same cross-axis size.
Answer: align-items: stretch (default value)

Q445. ________ is a JavaScript pattern ensuring a value is not used until its type has been narrowed.
Answer: Type narrowing (via typeof, instanceof, in operator, or type predicates)

Q446. ________ is a front-end architecture where state transitions are modelled as a state machine.
Answer: XState (or finite state machine pattern)

Q447. ________ is a browser API reading and modifying the URL query string without triggering a page reload.
Answer: URLSearchParams (with history.pushState)

Q448. ________ is a CSS variable defined on a specific element, overriding the same variable defined higher in the tree.
Answer: CSS custom property local override (cascading CSS variables)

Q449. ________ is a performance technique for fonts reducing layout shift by specifying font metric overrides matching the fallback font dimensions.
Answer: Font metric overrides (size-adjust, ascent-override, descent-override)

Q450. ________ is a JavaScript statement immediately exiting a loop.
Answer: break

---

## TOPIC 29: ADDITIONAL ADVANCED MCQ

Q451. What is hydration in the context of SSR?
A) Adding water to code B) The process of attaching React event listeners and state to server-rendered static HTML — making the page interactive after initial delivery C) Loading data D) A rendering technique
Answer: B — Hydration mismatch errors occur when server and client render different HTML.

Q452. What is Progressive Enhancement?
A) Gradual improvements B) Building a core experience that works for all users and devices, then enhancing for capable browsers and devices with advanced features C) A CSS approach D) A testing strategy
Answer: B — Contrast with Graceful Degradation — starting from full features and degrading.

Q453. What is the Temporal Dead Zone (TDZ)?
A) A timeout B) The period between entering a scope where a `let`/`const` variable is declared and the declaration being evaluated — accessing it throws a ReferenceError C) A time zone D) An async concept
Answer: B — TDZ is why `let` and `const` behave differently from `var` with hoisting.

Q454. What is a critical rendering path optimization?
A) Code optimization B) Eliminating render-blocking resources — loading CSS asynchronously for non-critical styles, deferring JavaScript, inlining critical CSS C) Server optimization D) Network optimization
Answer: B — Every render-blocking resource delays when the browser can first paint anything.

Q455. What is the `prefers-reduced-motion` media feature?
A) A performance feature B) A CSS media query detecting whether the user has requested the operating system to minimize non-essential motion C) An animation toggle D) A browser feature
Answer: B — Respect this for users with vestibular disorders triggered by motion.

Q456. What is the purpose of `rel="noopener noreferrer"` on target=_blank links?
A) SEO benefit B) `noopener` prevents the new tab from accessing the opener's window object (security). `noreferrer` additionally prevents sending the Referer header C) Performance benefit D) Styling
Answer: B — Always add to third-party links opened in new tabs to prevent reverse tabjacking.

Q457. What is module federation in webpack?
A) Multiple modules B) A webpack 5 feature enabling applications to dynamically load code from separate independently deployed builds at runtime, enabling micro-frontend architectures C) Code splitting D) Lazy loading
Answer: B — Module Federation is the primary technical enabler for micro-frontend composition.

Q458. What is the difference between SVG and Canvas for rendering?
A) No difference B) SVG is declarative, DOM-based, and scalable (each element is accessible/styleable). Canvas is imperative, pixel-based, and high performance for thousands of elements but not accessible C) Canvas is always better D) SVG is deprecated
Answer: B — SVG for UI icons and charts. Canvas/WebGL for games and visualizations with many elements.

Q459. What is an HTTP 304 status code in the context of frontend caching?
A) A redirect B) Not Modified — the browser had a cached version; the server confirms it is still valid, so the browser uses the cache rather than downloading the resource again C) An error D) A success
Answer: B — ETags and Last-Modified headers enable conditional requests returning 304.

Q460. What is the purpose of the `loading="eager"` attribute on images?
A) Fast loading B) Explicitly loads the image immediately — the default behavior for images. Used to override `loading="lazy"` on critical above-the-fold images C) A performance hint D) Async loading
Answer: B — Always use `loading="eager"` on LCP images to prevent lazy loading from delaying the LCP metric.

---

## TOPIC 30: FINAL SCENARIOS AND CONCEPTS

Q461. How do you approach performance testing and monitoring in a frontend application?
Answer: Development: run Lighthouse in Chrome DevTools regularly. Set performance budgets in build configuration — fail CI if bundle size exceeds threshold. Use `web-vitals` library capturing Core Web Vitals in production. Production monitoring: send Web Vitals to analytics (GA4 or custom endpoint) — measure actual user experience, not just synthetic tests. Real User Monitoring (RUM): track p75 and p95 percentiles, not just averages — slow users matter. Synthetic monitoring: scheduled Lighthouse CI runs from multiple locations detecting regressions. Error budgets: define acceptable LCP/INP/CLS thresholds per page. Performance regression testing: block deployments that significantly worsen Core Web Vitals. Profiling: use Chrome DevTools Performance tab for specific interaction profiling. Tooling: SpeedCurve, Calibre, or WebPageTest for historical tracking of performance metrics.

Q462. Explain how you would implement a design token system for a large application.
Answer: Tokens are the foundation: define primitive tokens (raw values) — `color.blue.500: #3b82f6`, `space.4: 16px`. Then semantic tokens mapping primitives to intent — `color.background.primary: {color.blue.500}`. Implementation: store tokens in a central JSON/YAML file (Style Dictionary is the standard tool for transformation). Generate: platform-specific outputs — CSS custom properties, JS objects, Sass variables, iOS Swift constants, Android XML. Usage: components reference semantic tokens only (`var(--color-background-primary)`), never primitive values directly. Theming: swap semantic token values per theme without changing components. Dark mode: redefine semantic tokens under a `[data-theme="dark"]` selector. Tooling: Figma tokens plugin syncing design and code tokens. Governance: design and engineering review token additions together to maintain semantic coherence.

Q463. How would you implement keyboard navigation for a custom dropdown component?
Answer: Following the ARIA Combobox pattern. HTML: input with `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"`, `aria-controls` pointing to the listbox. Listbox with `role="listbox"`, options with `role="option"`, `aria-selected`. Keyboard interactions: Down Arrow opens the list and moves focus to the first option (or next option if already open). Up Arrow moves to the previous option. Enter/Space selects the focused option and closes. Escape closes without selecting. Home/End moves to first/last option. Type-ahead: typing characters jumps to the first option starting with that character. Focus management: when the list opens, focus moves to the currently selected option (or first option). When closed, focus returns to the input/button. Prevent default on all these keys to avoid browser scroll. Tab closes the dropdown and moves to next focusable element.

Q464. How do you approach bundle size optimization for a React application?
Answer: Audit first: run `npx webpack-bundle-analyzer` or Vite's bundle visualizer to see what is taking space. Quick wins: replace heavy libraries with lighter alternatives (moment.js → date-fns, lodash → native methods or lodash-es with tree-shaking, large icon libraries → individual icon imports). Code splitting: lazy load all route components, lazy load heavy modal/drawer content. Dynamic imports: `import('./heavyModule')` on demand rather than at startup. Tree-shaking: ensure all imports use named exports from ES modules (`import { specific } from 'lib'` not `import lib from 'lib'`). Externalize: serve React from CDN with importmaps in multi-app architectures. Compression: enable Brotli compression on the server. Images: use WebP/AVIF, implement srcset, lazy load below the fold. Set budget: enforce max bundle size in CI with `bundlesize` package.

Q465. What is your approach to implementing a real-time notification system in a frontend application?
Answer: Technology choice: Server-Sent Events (SSE) for one-way server-to-client notifications — simpler than WebSockets, works over HTTP, automatic reconnection. WebSockets for bidirectional real-time features. Long polling as a fallback for restrictive network environments. SSE implementation: `const es = new EventSource('/notifications')`, listen to message events. Reconnection: SSE reconnects automatically; track the last event ID for recovery. Notification types: in-app notifications (toast, bell icon badge), push notifications via Push API + service worker for background delivery. State management: maintain a notifications list in global state, mark as read/unread, persist to localStorage. UI: toast notifications with auto-dismiss (accessible with role="status" or role="alert"), persistent notification center. Badge count: show unread count in favicon (Canvas API) or page title. Reconnection handling: show an indicator when disconnected from the notification stream.

---

## TOPIC 31: RAPID FIRE FILL IN THE BLANK — FINAL 75

Q466. ________ is the CSS property controlling how text is wrapped and where line breaks occur.
Answer: word-break (or overflow-wrap)

Q467. ________ is the HTML attribute providing a hint about the expected input for form autofill.
Answer: autocomplete

Q468. ________ is a React hook that runs after the browser has painted, making it safe to show content.
Answer: useEffect (runs after paint — use useLayoutEffect for before-paint measurements)

Q469. ________ is the JavaScript event bubbling from the document when the user presses a key.
Answer: keydown (or keyup, keypress — keypress is deprecated)

Q470. ________ is the CSS property controlling whether an element's background extends under the border.
Answer: background-clip

Q471. ________ is the JavaScript method removing the last element from an array and returning it.
Answer: Array.prototype.pop()

Q472. ________ is a CSS feature applying styles based on a parent container's size rather than the viewport.
Answer: Container queries (@container)

Q473. ________ is the minimum recommended color contrast ratio for large text (18pt or 14pt bold) in WCAG AA.
Answer: 3:1

Q474. ________ is the React pattern using a hook to share stateful logic between multiple components.
Answer: Custom hooks

Q475. ________ is a web standard enabling cryptographic operations like signing and verifying JWTs in the browser.
Answer: Web Crypto API (SubtleCrypto.sign, SubtleCrypto.verify)

Q476. ________ is the CSS property controlling the internal spacing between content and border.
Answer: padding

Q477. ________ is the JavaScript method creating a new array by removing or replacing elements.
Answer: Array.prototype.splice() (mutates) or Array.prototype.slice() (non-mutating)

Q478. ________ is a Next.js feature generating a dynamic sitemap.xml from all routes.
Answer: next-sitemap package or App Router route handler for /sitemap.xml

Q479. ________ is the browser storage method persisting data even after the browser is closed.
Answer: localStorage

Q480. ________ is the CSS property controlling how an absolutely positioned element is positioned when its containing block has a different writing mode.
Answer: inset (shorthand for top, right, bottom, left)

Q481. ________ is the JavaScript event fired when a drag operation ends.
Answer: dragend

Q482. ________ is the browser API for smooth scrolling to a position on the page.
Answer: window.scrollTo({ top: y, behavior: 'smooth' })

Q483. ________ is the HTML attribute preventing form submission and enabling custom JavaScript validation.
Answer: novalidate on `<form>` (combined with custom JavaScript validation)

Q484. ________ is the JavaScript method returning the index of the first element passing a test function.
Answer: Array.prototype.findIndex()

Q485. ________ is a CSS function selecting every nth child element of a parent.
Answer: :nth-child(n)

Q486. ________ is the React ecosystem pattern where parent components control child component state via props.
Answer: Controlled components

Q487. ________ is the HTML element that allows users to expand and collapse content natively without JavaScript.
Answer: `<details>` with `<summary>`

Q488. ________ is a CSS shorthand property for setting list-style-type, list-style-position, and list-style-image.
Answer: list-style

Q489. ________ is a JavaScript object providing methods for encoding and decoding URL components.
Answer: URL (or URLSearchParams for query strings)

Q490. ________ is the React DevTools feature showing which component is causing a re-render.
Answer: React DevTools Profiler (with highlight updates and "why did this render?")

Q491. ________ is a CSS media feature detecting if the user's device is in dark mode.
Answer: prefers-color-scheme: dark

Q492. ________ is the HTML attribute providing machine-readable metadata for links and other elements.
Answer: rel attribute

Q493. ________ is a JavaScript pattern for composing multiple higher-order functions into a single pipeline.
Answer: Function composition (compose or pipe utilities)

Q494. ________ is the CSS property making an element a new formatting context, clearing floats and preventing margin collapse.
Answer: display: flow-root (or overflow: hidden historically)

Q495. ________ is a build-time optimization converting SVG files into React components with tree-shaking support.
Answer: SVGR (svg-to-react transformer)

---

# PART 2: ROUND TYPE QUESTIONS (Q501–Q640)

---

## ROUND TYPE: SCENARIO QUESTIONS

Q501. You are building a product listing page that currently loads 500 products at once and is slow. How do you fix it?
Answer: Multiple strategies depending on the use case. Pagination: show 20-50 products per page with page number navigation — simplest solution, great for SEO, predictable. Infinite scroll: load the next batch when the user scrolls near the bottom using IntersectionObserver — good for exploration interfaces, worse for finding a specific item. Virtual scrolling: render only the items currently visible using react-virtual or react-window — render all 500 but only paint 20-30 at once. The DOM stays small. Backend pagination: never send 500 items from the server — implement proper cursor or offset pagination in the API. Image optimization: lazy load product images below the fold. Skeleton loading: show placeholder cards immediately while data loads. Filter/search: let users narrow results so the list is manageable. Measure: profile with Chrome DevTools before and after to quantify improvement.

Q502. A client asks you to build a form that works offline and submits when connectivity is restored. How do you implement this?
Answer: Service worker with Background Sync. When the form is submitted offline: catch the failed fetch in a service worker, store the form data in IndexedDB, register a sync event `registration.sync.register('submit-form')`. When connectivity is restored, the browser fires the `sync` event in the service worker. The service worker reads pending form data from IndexedDB, attempts the submission, and removes the data on success. UI feedback: detect `navigator.onLine` for immediate feedback, but do not rely on it for reliability (it can be inaccurate). Show a clear "Your submission will be sent when online" message. Cache the form page itself so it renders offline. Test thoroughly — edge cases include the user submitting multiple times before connectivity is restored (deduplicate with a unique ID per submission).

Q503. Your single-page application takes 8 seconds to become interactive on a 3G connection. What do you do?
Answer: 8 seconds is catastrophically slow — systematic optimization. Measure: run WebPageTest on a 3G throttled connection to identify the specific bottlenecks. Initial bundle: analyze with bundle analyzer. Split all routes with React.lazy. Remove unused dependencies. Eliminate large libraries (moment, lodash). JavaScript parsing: large JS bundles take significant time to parse on low-powered mobile CPUs. Use the Coverage tab in DevTools to find unused code. Critical path: inline critical CSS in the HTML head. Defer non-critical scripts with async/defer. Preload key resources with `<link rel="preload">`. Server: enable compression (Brotli), HTTP/2, edge caching. Images: lazy load below fold, WebP format, appropriate sizes. Consider SSR: render HTML on the server so users see content before JS loads. Target: aim for under 3 seconds on 3G for LCP. Add performance budget to CI to prevent regression.

Q504. How do you handle a situation where your React application must support Internet Explorer 11?
Answer: Important context: IE11 was officially retired in 2022. But if required: Add Babel polyfills (core-js) for modern JavaScript features. Configure Babel targets to include IE11. Add CSS vendor prefixes with Autoprefixer. Avoid: ES modules, CSS Grid (limited IE11 support), CSS custom properties, CSS Grid's `gap` property, modern browser APIs (IntersectionObserver, Fetch — polyfill these). Test in a Windows VM with IE11. Use IE11-compatible React patterns (class components if hooks have issues). Be explicit with the client about the cost — IE11 support significantly increases bundle size, development complexity, and limits feature capabilities. Strongly recommend establishing an EOL date for IE11 support aligned with Microsoft's official end of support.

Q505. You are building a dashboard showing real-time stock prices updating every second. How do you architect the frontend?
Answer: Data delivery: WebSockets or Server-Sent Events for push-based price updates — avoid polling. Technology: React with a dedicated WebSocket hook managing connection lifecycle, reconnection, and cleanup. State management: use Zustand or React Context for the prices store. Performance: 1-second updates for potentially hundreds of symbols is demanding. Batch UI updates using `startTransition` to keep the page responsive. Use `useMemo` to avoid recomputing derived data on every tick. Virtual scroll if showing many symbols simultaneously. Only re-render cells that changed — use React.memo on individual price cells. Throttle UI updates: update the data layer every second but only render at 60fps using requestAnimationFrame. Chart: use a canvas-based charting library (lightweight-charts by TradingView) for tick-level performance. Cleanup: properly close WebSocket on unmount. Handle disconnection with automatic reconnection and a visual indicator.

Q506. How do you implement a drag-and-drop kanban board in React?
Answer: Library choice: dnd-kit is the modern recommendation — accessible, touch-friendly, and performant. Avoid react-beautiful-dnd (deprecated). Implementation: define drag sources (cards) and drop targets (columns and positions within columns). Drag state: track the active dragged item ID and which column/position the pointer is over. Optimistic updates: update the UI immediately on drop, then sync to the server. Collision detection: use dnd-kit's collision detection algorithms for correct hover behavior. Keyboard accessibility: full keyboard drag-and-drop following the ARIA drag-and-drop pattern — Space to lift, arrow keys to move, Space/Enter to drop, Escape to cancel. Announce actions to screen readers using a live region. Animation: use CSS transforms for smooth animations during drag — animate the overlay card position and the drop area indicator. Persistence: save order to the server on drop via an API call.

Q507. You need to optimize a React application's Time to Interactive (TTI) from 12 seconds to under 3 seconds. What is your strategy?
Answer: Systematic approach. Measure: WebPageTest waterfall diagram, Chrome DevTools Coverage tab, Performance tab for long tasks. JavaScript reduction: code split aggressively — every route lazy loaded, every modal and heavy component lazy loaded. Analyze bundle — remove or replace heavy dependencies. Defer non-critical JavaScript with async/defer. Critical rendering path: inline above-the-fold CSS. Preload key JavaScript chunks. Server-side rendering: render initial HTML on the server — SSR + hydration means users see content before JS is fully loaded. Reduce main thread blocking: break up long tasks into chunks using scheduler.yield() or setTimeout. Move heavy computation to Web Workers. Third-party scripts: audit every third-party script (analytics, chat, ads) — they frequently account for 50%+ of blocking time. Lazy load them after TTI. React: eliminate unnecessary renders at the top of the component tree.

Q508. A major refactor replaced the CSS framework from Bootstrap to Tailwind. QA reports that spacing and sizing is inconsistent across the app. What do you do?
Answer: Visual regression testing: implement screenshot comparison testing (Playwright with pixelmatch, or Chromatic for Storybook) to catch layout regressions automatically going forward. Systematic audit: create a grid of all components in Storybook and review each. Cross-browser test matrix. Design token audit: verify Tailwind's spacing scale matches the design system's expected values. Create a mapping document: Bootstrap `px-3` ≡ Tailwind `px-3` (12px) — verify each component was correctly converted. Hotfixes: address critical user-facing inconsistencies immediately. Document: create a migration guide showing Bootstrap → Tailwind equivalences for future reference. Prevention: add visual regression to CI pipeline. Lesson: major CSS refactors should always include comprehensive visual regression testing with approval workflow for intentional changes.

---

## ROUND TYPE: ARCHITECTURE AND SYSTEM DESIGN

Q509. Design the frontend architecture for a large-scale e-commerce application.
Answer: Framework: Next.js App Router for SSR/SSG/ISR — product pages statically generated for SEO, personalized content dynamically rendered. Routing: file-based with dynamic segments for categories and products. Data fetching: React Server Components fetch product data directly, Client Components handle cart and user state. State: Zustand for cart and user session, React Query for server state synchronization. Performance: Next.js Image for all product images, ISR with 60-second revalidation for product data, Edge Middleware for A/B testing and geo-based redirects. Search: Algolia integration with instant search UI components. Checkout: isolated from main app with stricter CSP and PCI compliance boundaries. Design system: Radix UI primitives with custom Tailwind-based styling. Testing: Playwright for critical paths (product search, add to cart, checkout), React Testing Library for components. CDN: Vercel Edge Network or CloudFront for global asset delivery. Monitoring: Sentry for errors, Core Web Vitals tracking per page type.

Q510. Design a component library that will be shared across 5 different React applications.
Answer: Foundation: Vite library mode for building, TypeScript for type safety, CSS Modules or Tailwind for styling. Package: publish to npm (private registry for internal use). Monorepo: Turborepo or Nx managing the component library alongside consuming apps. Design tokens: Style Dictionary generating CSS custom properties and JS constants from a single token file. Component API: Radix UI primitives as headless foundation — compose with styling on top. Documentation: Storybook deployed to a shared URL — single source of truth for designers and developers. Versioning: semantic versioning, CHANGELOG with every release, codemods for breaking changes. Testing: unit tests for logic, visual regression in Storybook with Chromatic. Accessibility: axe-core in tests, ARIA patterns from ARIA Authoring Practices Guide. Bundle optimization: tree-shakeable ES module build, no bundled peer dependencies (React). CI/CD: automated releases on merge to main, preview Storybooks on every PR.

Q511. Design the state management architecture for a complex React enterprise dashboard.
Answer: Layered state architecture. Server state: React Query for all API data — handles caching, refetching, optimistic updates, and loading states. No manual useEffect for data fetching. UI state: React Context for low-frequency shared state — current theme, user preferences, active modal. Component state: useState and useReducer for component-local state — forms, open/closed toggles. URL state: search params for state that should be bookmarkable — filters, pagination, selected tab. Global client state: Zustand for application-level state that does not fit above categories — notification queue, WebSocket connection state. Data normalization: normalize API responses (or use RTK Query's normalization) to prevent data duplication. Optimistic updates: React Query mutation with `onMutate` for instant feedback. Avoid: putting server data in Redux/Zustand manually — that is React Query's job. Rule: state should live at the lowest level that meets its needs.

---

## ROUND TYPE: CODING QUESTIONS

Q512. Implement a custom useLocalStorage hook in React.

Answer:
```javascript
import { useState, useEffect } from 'react';

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function
        ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}
```

Q513. Implement a custom useFetch hook with loading, error, and data states.

Answer:
```javascript
import { useState, useEffect, useRef } from 'react';

function useFetch(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    fetch(url, { ...options, signal: abortRef.current.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => { setData(data); setLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => abortRef.current.abort();
  }, [url]);

  return { data, loading, error };
}
```

Q514. Implement a throttle function.

Answer:
```javascript
function throttle(fn, limit) {
  let lastRun = 0;
  let timeout;

  return function(...args) {
    const now = Date.now();
    const remaining = limit - (now - lastRun);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastRun = now;
      fn.apply(this, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastRun = Date.now();
        timeout = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
// const throttledScroll = throttle(handleScroll, 100);
```

Q515. Implement a deep equality function for objects.

Answer:
```javascript
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) &&
    deepEqual(a[key], b[key])
  );
}
```

Q516. Implement a function flattening a deeply nested array to a specified depth.

Answer:
```javascript
function flatten(arr, depth = Infinity) {
  if (depth === 0) return arr.slice();

  return arr.reduce((acc, val) => {
    if (Array.isArray(val) && depth > 0) {
      acc.push(...flatten(val, depth - 1));
    } else {
      acc.push(val);
    }
    return acc;
  }, []);
}
// Or: arr.flat(Infinity) — native method
```

Q517. Implement a simple observable/event emitter.

Answer:
```javascript
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
    return () => this.off(event, listener); // Returns unsubscribe
  }

  off(event, listener) {
    this.events[event] = (this.events[event] || [])
      .filter(l => l !== listener);
  }

  emit(event, ...args) {
    (this.events[event] || []).forEach(l => l(...args));
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}
```

Q518. Implement a virtualized list rendering only visible items.

Answer:
```javascript
import { useState, useRef, useMemo } from 'react';

function VirtualList({ items, itemHeight, containerHeight }) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(start + visibleCount + 1, items.length);
    return { startIndex: start, endIndex: end, offsetY: start * itemHeight };
  }, [scrollTop, itemHeight, containerHeight, items.length]);

  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={e => setScrollTop(e.target.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {items.slice(startIndex, endIndex).map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Q519. Write a CSS-only responsive navigation that collapses to a hamburger menu on mobile.

Answer:
```css
.nav { display: flex; gap: 1rem; }
.hamburger { display: none; cursor: pointer;
  background: none; border: none; }
.nav-links { display: flex; gap: 1rem; list-style: none; }

@media (max-width: 768px) {
  .hamburger { display: block; }
  .nav-links {
    display: none; flex-direction: column;
    position: absolute; top: 60px; left: 0;
    width: 100%; background: white;
    padding: 1rem;
  }
  /* Toggle via checkbox hack (no JS) */
  #nav-toggle:checked ~ .nav-links { display: flex; }
}
```
For production, use JavaScript for proper accessibility (aria-expanded, focus management, Escape key support).

Q520. Implement an accessible toast notification system in React.

Answer:
```javascript
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => removeToast(id), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        style={{ position: 'fixed', bottom: '1rem', right: '1rem' }}
      >
        {toasts.map(toast => (
          <div key={toast.id} role="alert">
            {toast.message}
            <button onClick={() => removeToast(toast.id)}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
```

---

## ROUND TYPE: CONCEPT MCQ — RAPID FIRE

Q521. What is the difference between `==` null check and `=== null` check?
A) No difference B) `== null` is true for both null and undefined (useful); `=== null` only matches null C) Both are the same D) `==` is more strict
Answer: B — `value == null` is a common shorthand for "null or undefined".

Q522. What does `Array.isArray([])` return?
A) false B) true C) undefined D) TypeError
Answer: B — More reliable than `typeof []` which returns 'object'.

Q523. What is the output of `typeof null`?
A) 'null' B) 'object' C) 'undefined' D) 'boolean'
Answer: B — This is a well-known JavaScript bug that cannot be fixed without breaking the web.

Q524. What does CSS `outline: none` do and when is it dangerous?
A) Removes all borders B) Removes the focus indicator — dangerous for accessibility as keyboard users lose visual feedback of which element is focused C) Improves performance D) It is always safe
Answer: B — Never use outline:none without providing an alternative focus style.

Q525. What is the difference between `undefined` and `null` in JSON serialization?
A) No difference B) `JSON.stringify` converts `undefined` values to nothing (omits the key); `null` is preserved as `null` in JSON C) Both become null D) Both are omitted
Answer: B — `JSON.stringify({ a: undefined, b: null })` → `{"b":null}`.

Q526. What does `display: contents` do?
A) Shows hidden content B) Removes the element's box from the layout while keeping its children — useful for semantic wrappers that should not affect grid/flex layout C) Makes content visible D) Displays content inline
Answer: B — The element participates in semantics but not layout.

Q527. What is the difference between `em` and `ch` CSS units?
A) No difference B) `em` is relative to the current element's font-size; `ch` is the width of the "0" character in the current font — useful for input sizing C) ch is absolute D) em is for width
Answer: B — `width: 20ch` sizes an input for approximately 20 characters.

Q528. What does `position: absolute` position relative to?
A) The viewport B) The nearest ancestor with `position` set to anything other than `static` C) The document root D) The parent element
Answer: B — If no positioned ancestor exists, it positions relative to the initial containing block (viewport).

Q529. What is the difference between `window.onload` and `DOMContentLoaded`?
A) No difference B) DOMContentLoaded fires when HTML is parsed; window.onload fires after all resources (images, CSS, scripts) finish loading C) onload is faster D) DOMContentLoaded includes images
Answer: B — Prefer DOMContentLoaded for faster initialization when images are not needed.

Q530. What is the purpose of `Object.freeze()`?
A) Slows the object down B) Makes an object immutable — prevents adding, removing, or modifying properties C) Deep-freezes nested objects D) Prevents object deletion
Answer: B — `Object.freeze()` is shallow — nested objects are not frozen.

---

## ROUND TYPE: FILL IN THE BLANK — RAPID FIRE

Q531. ________ is the CSS function applying a drop shadow on any element shape including transparent areas.
Answer: filter: drop-shadow() (vs box-shadow which follows the box model)

Q532. ________ is the HTML attribute specifying a unique identifier for an element, used in CSS, JavaScript, and ARIA.
Answer: id

Q533. ________ is a JavaScript technique calling a function immediately after defining it.
Answer: IIFE (Immediately Invoked Function Expression)

Q534. ________ is the CSS unit relative to the font-size of the root element.
Answer: rem

Q535. ________ is a React pattern preventing re-renders by checking if props changed before updating.
Answer: React.memo (or shouldComponentUpdate in class components)

Q536. ________ is the HTML attribute telling the browser to preload a video or audio file.
Answer: preload="auto" (or metadata, none)

Q537. ________ is the JavaScript operator accessing a deeply nested property safely without throwing if an intermediate value is null.
Answer: Optional chaining (?.)

Q538. ________ is the React hook accessing the previous value of a prop or state variable.
Answer: usePrevious (custom hook using useRef)

Q539. ________ is the CSS property controlling an element's appearance when it is being actively dragged.
Answer: cursor: grabbing (or cursor: grab when hoverable)

Q540. ________ is the browser event firing when a focused element loses focus.
Answer: blur (or focusout — which bubbles)

Q541. ________ is the JavaScript method returning the element at a specific point in the viewport.
Answer: document.elementFromPoint(x, y)

Q542. ________ is a CSS pseudo-class matching an element when it currently has keyboard focus.
Answer: :focus-visible (preferred over :focus for styling)

Q543. ________ is the React prop passing a ref to a child component that does not natively support refs.
Answer: forwardRef (React.forwardRef)

Q544. ________ is the HTTP status code indicating a resource has permanently moved to a new URL.
Answer: 301 Moved Permanently

Q545. ________ is the CSS property enabling smooth font rendering on macOS and iOS.
Answer: -webkit-font-smoothing: antialiased (or font-smooth)

Q546. ________ is a JavaScript object representing a URL and providing methods to read and modify URL components.
Answer: URL (new URL('https://example.com'))

Q547. ________ is the HTML element providing text track captions and subtitles for video elements.
Answer: `<track>`

Q548. ________ is the process in webpack where identical modules imported by multiple chunks are extracted into a shared chunk.
Answer: SplitChunksPlugin (or common chunk extraction)

Q549. ________ is the CSS property controlling the transparency of an element and all its descendants.
Answer: opacity

Q550. ________ is a JavaScript design pattern where an object notifies multiple dependent objects when its state changes.
Answer: Observer pattern

---

## ROUND TYPE: MOCK INTERVIEW QUESTIONS

Q551. Interviewer: Explain what happens when you type a URL in the browser and press Enter.
Answer: DNS resolution: browser checks DNS cache, then OS cache, then queries DNS resolver to resolve the domain to an IP address. TCP connection: browser establishes a TCP connection with the server via three-way handshake (SYN, SYN-ACK, ACK). TLS handshake: for HTTPS, TLS negotiation establishes an encrypted connection. HTTP request: browser sends an HTTP GET request with headers (Host, User-Agent, Accept, cookies). Server processing: server processes the request, queries databases if needed, generates a response. HTTP response: server sends HTML with status code and response headers (Content-Type, Cache-Control, Set-Cookie). Browser parsing: browser receives the HTML, begins parsing, builds the DOM tree. As CSS links are encountered, they are fetched and CSSOM is built. JavaScript files are fetched and executed (blocking unless async/defer). Rendering: DOM + CSSOM → Render Tree → Layout (positions and sizes) → Paint (pixels to screen) → Composite. Additional resources: images, fonts, and scripts are fetched as they are encountered.

Q552. Interviewer: What is your approach to debugging a complex React state management bug?
Answer: Systematic isolation. First, reproduce the bug reliably and document the exact steps. React DevTools: check the component tree and see current state values. React DevTools Profiler: identify which components re-render and when. Console logging: temporarily add logging at state update points to trace the data flow. Binary search: comment out half the code path to narrow down where the incorrect state enters. Redux DevTools (if using Redux): replay the action sequence and inspect state at each step. For context bugs: check if Provider is above the consuming component. For stale closure bugs: check if useEffect/useCallback dependencies are complete. For unexpected renders: check if reference equality is causing false re-renders (objects created on each render). React StrictMode: double-invokes renders in development — useful for catching impure renders. Simplify: extract the problematic logic into a minimal reproduction case.

Q553. Interviewer: You join a team maintaining a large React codebase with poor performance. What is your 30-60-90 day plan?
Answer: Days 1-30: Understand and measure. Set up proper performance monitoring — Web Vitals in production, Lighthouse CI in the build pipeline. Identify the 3 worst-performing pages by LCP, INP, and CLS. Profile the worst offender with Chrome DevTools Performance tab. Document current baseline metrics. Understand the codebase — component architecture, state management approach, data fetching patterns, build configuration. Identify the most impactful and least risky improvements. Days 30-60: Quick wins. Fix the top 3 issues identified in profiling — typically: images without dimensions (CLS), large synchronous JavaScript (INP), render-blocking resources (LCP). Add React.memo to the most frequently re-rendering components. Implement code splitting for the largest routes. Update bundle analyzer and remove obviously unused dependencies. Days 60-90: Systemic improvements. Migrate data fetching to React Query, eliminating waterfall requests. Implement virtual scrolling for any long lists. Establish performance review in PR process. Educate the team on the patterns causing the issues found.

Q554. Interviewer: How do you ensure the accessibility of a component you are building?
Answer: Start from the beginning — accessibility is not a bolt-on. HTML semantics: use the correct HTML element for the purpose (button for buttons, not div). The correct element provides keyboard access, ARIA roles, and browser behavior for free. Interactive elements: ensure all interactive elements are keyboard accessible (focusable, operable with Enter/Space). Do not use non-semantic elements for interaction. ARIA: add ARIA only when native HTML semantics are insufficient. Follow the ARIA Authoring Practices Guide for complex widgets (combobox, dialog, tabs). Focus management: manage focus correctly for modals, slide-overs, and dynamic content. Color and contrast: verify 4.5:1 contrast ratio. Do not use color as the only differentiator. Text alternatives: alt text for images, labels for form fields, captions for videos. Test with a screen reader (VoiceOver on Mac, NVDA on Windows) — reading about ARIA is insufficient for understanding how it actually works. Use axe-core in automated tests to catch programmatic issues.

Q555. Interviewer: Describe a technically challenging frontend problem you solved.
How to answer: Prepare a specific story covering: the technical context (what system, what constraints), the specific challenge (performance bottleneck, complex interaction, cross-browser issue, accessibility requirement), your diagnostic process (how you identified the root cause), the solution you implemented (specific technical details), and the measurable outcome (load time reduced by X%, error rate dropped from Y% to Z%). Demonstrate depth of technical knowledge, systematic problem-solving, and clear communication. The story should be something you personally solved, not your team — use "I" not "we" for your specific contributions.

Q556. Interviewer: What is your philosophy on writing CSS in 2024?
Answer: Utility-first where appropriate: Tailwind CSS for the majority of styling reduces cognitive overhead, enforces design system constraints, and eliminates the naming problem. CSS for customization: CSS custom properties for theming and design tokens — the cascade and inheritance make them powerful for theming across components. Avoid over-engineering: CSS Modules or simple BEM for component-specific styles when Tailwind is insufficient. Avoid CSS-in-JS with runtime overhead for new projects — the performance cost is hard to justify. Modern CSS is powerful: container queries, cascade layers, `has()`, `clamp()`, and logical properties reduce the need for JavaScript. Separate concerns: do not use CSS for logic (complex state management via CSS only gets messy). Prioritize: mobile-first, performance (minimize unused CSS), accessibility (focus styles, reduced motion), and maintainability over cleverness.

Q557. Interviewer: How do you approach testing in a frontend project?
Answer: Testing philosophy: test behavior, not implementation. Tests should tell you what broke and why, not just that something broke. Test pyramid: many unit tests for pure utility functions. Component tests using React Testing Library for interactive components — test them like a user would. Integration tests for complex multi-component flows. A small number of E2E tests covering critical business flows (auth, checkout, core feature). Tools: Vitest for unit and component tests (faster than Jest). React Testing Library for component testing. Playwright for E2E. MSW for API mocking. Priorities: highest-value tests first — authentication, checkout, core feature. Not every component needs tests. What to avoid: testing implementation details (which state variable is set). Snapshot tests for everything. Tests that only pass when the application actually works (tautological tests). CI integration: all tests run on every PR, block merges on failure. Target meaningful coverage, not 100% — untested complex logic matters more than tested trivial code.

Q558. Interviewer: Explain the React component lifecycle in hooks.
Answer: Mounting: The component renders for the first time. `useState` initializer runs. JSX is returned and the DOM is updated. `useLayoutEffect` runs synchronously before the browser paints. `useEffect` with empty dependency array `[]` runs after the first paint — equivalent to componentDidMount. Updating: A state or prop change triggers a re-render. The component function runs again. React diffs the new JSX with the previous render. DOM updates are applied. `useLayoutEffect` cleanup runs, then the new `useLayoutEffect` runs. `useEffect` cleanup runs for effects with changed dependencies, then the new `useEffect` runs. Unmounting: The component is removed from the DOM. All `useEffect` and `useLayoutEffect` cleanup functions run — equivalent to componentWillUnmount. Key insight: `useEffect` with dependencies `[a, b]` runs when `a` or `b` changes. The cleanup function runs before the next execution and on unmount. Returning a cleanup from every useEffect that adds subscriptions or event listeners is critical for preventing memory leaks.

Q559. Interviewer: What is your approach to code review for frontend PRs?
Answer: Purpose: code review improves quality, spreads knowledge, and builds shared standards — not just finding bugs. What I look for: correctness — does the code do what it claims? Are edge cases handled? Accessibility — are new interactive elements keyboard accessible? Are ARIA roles correct? Performance — any obvious render performance issues? Unnecessary re-renders? Large images without optimization? Security — XSS risks from innerHTML with user data? Client-side secrets? Type safety — TypeScript types correct and meaningful (not overuse of any)? Tests — are critical paths tested? Do tests test behavior or implementation? Code clarity — will someone understand this in 6 months? Are complex sections documented? Consistency — does it follow established patterns in the codebase? What I do not review: formatting — that is Prettier's job. Minor naming preferences — these are not worth blocking a PR. I approve if it is correct and safe, and communicate suggestions as optional improvements. I leave PR comments as learning opportunities, not criticism.

Q560. Interviewer: What is the most important thing you have learned about frontend development in the last year?
How to answer: Authentic answers are most compelling. Strong current topics: React Server Components fundamentally changing the data fetching model; the Web Platform catching up to frameworks (Container Queries, View Transitions, Popover API); AI-assisted development (GitHub Copilot) and how to use it effectively; the importance of Core Web Vitals as real business metrics; Signals as a reactivity model appearing across frameworks (Preact Signals, SolidJS, Angular Signals). Demonstrate genuine curiosity and that you stay current with the rapidly evolving frontend ecosystem. Tie the learning to practical impact — "I learned X, which changed how I Y, resulting in Z."

---

## ROUND TYPE: FILL IN THE BLANK — FINAL RAPID FIRE

Q561. ________ is the CSS property controlling whether an element's contents are clipped to its border box.
Answer: overflow: hidden

Q562. ________ is the JavaScript spread syntax equivalent for passing array elements as function arguments.
Answer: fn(...args) (spread in function call position)

Q563. ________ is a React pattern where a component delegates rendering control to its parent via a render prop function.
Answer: Render props

Q564. ________ is the CSS property enabling content to be shown on top of other elements without affecting layout.
Answer: position: absolute (or fixed, or sticky with z-index)

Q565. ________ is the HTML element grouping related options inside a `<select>` dropdown.
Answer: `<optgroup>`

Q566. ________ is the JavaScript method stopping event propagation and preventing the default action in one call.
Answer: event.stopImmediatePropagation() stops propagation to other listeners; there is no single method for both — use both event.stopPropagation() and event.preventDefault()

Q567. ________ is the CSS property making content appear above or below the normal flow of text.
Answer: vertical-align (for inline elements) or line-height

Q568. ________ is the webpack configuration option generating a JSON file of all output bundles for analysis.
Answer: BundleAnalyzerPlugin (or stats: 'verbose')

Q569. ________ is the React hook for subscribing to the browser's online/offline status.
Answer: Custom hook using navigator.onLine and online/offline events

Q570. ________ is the CSS property enabling smooth image scaling within its container maintaining aspect ratio.
Answer: object-fit: cover (or contain)

Q571. ________ is a JavaScript method returning a promise resolving with the first successfully resolved promise.
Answer: Promise.any()

Q572. ________ is a React Testing Library method finding an element that may not exist yet, waiting up to the timeout.
Answer: findByRole() (async query — returns a promise)

Q573. ________ is the CSS property controlling the display behavior of list item markers.
Answer: list-style-position: inside (or outside)

Q574. ________ is the TypeScript operator asserting a value is not null or undefined.
Answer: Non-null assertion operator (!)

Q575. ________ is the CSS property allowing a flex child to grow if there is extra space in the container.
Answer: flex-grow

Q576. ________ is the JavaScript built-in object providing internationalization functionality like date, number, and list formatting.
Answer: Intl (Intl.DateTimeFormat, Intl.NumberFormat, Intl.ListFormat)

Q577. ________ is the CSS feature detecting the user's preference for color contrast.
Answer: @media (prefers-contrast: more)

Q578. ________ is a React utility rendering a component to a plain JavaScript object for testing and other non-DOM environments.
Answer: React.renderToStaticMarkup (server-side) or @testing-library/react render

Q579. ________ is the HTML attribute preventing a `<form>` from being automatically submitted when Enter is pressed.
Answer: There is no single attribute — use type="button" on non-submit buttons, or handle keydown on the form

Q580. ________ is a web standard replacing the deprecated AppCache for offline resource management.
Answer: Service Worker Cache API

Q581. ________ is the JavaScript method creating an array from a Set, removing all duplicate values.
Answer: [...new Set(arr)] (or Array.from(new Set(arr)))

Q582. ________ is the CSS property controlling how animation keyframes progress over time between frames.
Answer: animation-timing-function

Q583. ________ is the React prop enabling components to render into a different DOM node than their parent.
Answer: ReactDOM.createPortal(children, domNode)

Q584. ________ is the JavaScript API communicating between different browsing contexts on the same origin.
Answer: BroadcastChannel API

Q585. ________ is the CSS property animating multiple values at different durations and timing in one declaration.
Answer: transition: property1 duration1 easing1, property2 duration2 easing2

Q586. ________ is the ESLint rule preventing React hooks from being called conditionally.
Answer: react-hooks/rules-of-hooks

Q587. ________ is the JavaScript operator computing the remainder of a division.
Answer: % (modulo operator)

Q588. ________ is the HTML element creating an interactive widget where the user can expand to get more information.
Answer: `<details>` with `<summary>`

Q589. ________ is the browser API providing geometry information about an element relative to the viewport.
Answer: getBoundingClientRect()

Q590. ________ is the CSS property enabling rounded corners on elements with `overflow: hidden` children that visually overflow.
Answer: border-radius (with overflow: hidden on the parent)

Q591. ________ is a React pattern composing behaviors from multiple hooks into a single feature hook.
Answer: Custom hooks composing other hooks

Q592. ________ is the CSS property enabling text to flow into multiple columns newspaper-style.
Answer: column-count (or columns shorthand)

Q593. ________ is the browser event fired when a service worker update is available.
Answer: updatefound event on ServiceWorkerRegistration

Q594. ________ is the JavaScript method converting a relative URL to an absolute one using a base URL.
Answer: new URL(relative, base).href

Q595. ________ is the TypeScript feature deriving a new type from an existing one by making all properties required.
Answer: Required<T>

Q596. ________ is the CSS property enabling an element to contribute to the accessibility tree while being visually hidden.
Answer: CSS visually-hidden technique (clip, clip-path, not display:none or visibility:hidden)

Q597. ________ is a JavaScript feature allowing import() to dynamically load modules at runtime.
Answer: Dynamic import (import() — returns a Promise)

Q598. ________ is the React strict mode behavior that helps detect unintentional side effects by double-invoking.
Answer: Concurrent mode double invocation (React StrictMode)

Q599. ________ is the CSS media feature detecting touch input capability.
Answer: @media (pointer: coarse) for touch screens, (pointer: fine) for mouse

Q600. ________ is the HTML attribute making an element editable by the user.
Answer: contenteditable

Q601. ________ is the JavaScript property returning the visible portion of an element's content.
Answer: element.clientWidth / element.clientHeight

Q602. ________ is the CSS property enabling grid items to span multiple row or column tracks.
Answer: grid-column: span 2 (or grid-row: span 2)

Q603. ________ is the React hook that lets a child component expose an imperative interface to its parent.
Answer: useImperativeHandle

Q604. ________ is the browser API measuring paint timing — first paint and first contentful paint.
Answer: PerformanceObserver with 'paint' entry type

Q605. ________ is the TypeScript feature allowing a function to return different types based on the input type.
Answer: Function overloads (or conditional return type)

Q606. ________ is the CSS property enabling nested CSS rules without a preprocessor.
Answer: CSS Nesting (& selector — native browser support 2023+)

Q607. ________ is the JavaScript event fired on window when the browser is about to print.
Answer: beforeprint (and afterprint)

Q608. ________ is the React 18 hook returning a boolean indicating whether a transition is pending.
Answer: useTransition (returns [isPending, startTransition])

Q609. ________ is the browser API creating high-resolution timestamps for performance measurement.
Answer: performance.now()

Q610. ________ is the CSS property making SVG elements scale without loss of quality at any size.
Answer: SVG is inherently vector-based; use width/height in CSS and viewBox attribute

Q611. ________ is the JavaScript method returning a new array with all elements that pass a test function.
Answer: Array.prototype.filter()

Q612. ________ is the HTML attribute telling the browser which resource to fetch next for future navigation.
Answer: `<link rel="prefetch">` (or preload for current page resources)

Q613. ________ is the CSS property applied to the scroll container enabling snap scrolling behavior.
Answer: scroll-snap-type

Q614. ________ is the React pattern avoiding prop drilling by composing components at the point of usage.
Answer: Component composition (or inversion of control)

Q615. ________ is the TypeScript utility creating a type with only the specified keys of an existing type.
Answer: Pick<Type, Keys>

Q616. ________ is the browser API for detecting when the user's battery is running low.
Answer: Battery Status API (navigator.getBattery())

Q617. ________ is the CSS property enabling lazy rendering of off-screen content for performance.
Answer: content-visibility: auto

Q618. ________ is the JavaScript method returning a string with whitespace from both ends removed.
Answer: String.prototype.trim()

Q619. ________ is the Next.js feature caching fetch responses at the server level with configurable revalidation.
Answer: Next.js fetch caching (fetch with { next: { revalidate: 60 } })

Q620. ________ is the HTML element providing a summary of a `<figure>` element.
Answer: `<figcaption>`

Q621. ________ is the CSS property making an element's positioned children relative to it.
Answer: position: relative (with children position: absolute)

Q622. ________ is the JavaScript API for scheduling tasks to run during browser idle time.
Answer: requestIdleCallback()

Q623. ________ is the React approach for sharing non-visual logic across components.
Answer: Custom hooks

Q624. ________ is the browser event fired when a user's network connection changes.
Answer: online / offline events (window.addEventListener('online', handler))

Q625. ________ is the CSS pseudo-element used to style the placeholder text of an input.
Answer: ::placeholder

Q626. ________ is the TypeScript generic constraint allowing only object types.
Answer: T extends object (or T extends Record<string, unknown>)

Q627. ________ is a web performance technique preloading resources needed for the current page's critical path.
Answer: `<link rel="preload" as="script">` (or as="style", as="font")

Q628. ________ is the React 18 root API enabling concurrent features.
Answer: ReactDOM.createRoot() (replacing ReactDOM.render())

Q629. ________ is the CSS grid shorthand placing an item in a named area defined in grid-template-areas.
Answer: grid-area: area-name

Q630. ________ is the JavaScript method pausing execution of an async function until a Promise settles.
Answer: await

Q631. ________ is the Next.js App Router feature providing error UI at the route segment level.
Answer: error.tsx (Error Boundary file convention)

Q632. ________ is the CSS property enabling multiline text truncation with an ellipsis.
Answer: -webkit-line-clamp with display: -webkit-box

Q633. ________ is the browser API enabling speech recognition input.
Answer: SpeechRecognition API (Web Speech API)

Q634. ________ is the React pattern using a type discriminant to narrow which variant of a union type a component receives.
Answer: Discriminated union props with TypeScript

Q635. ________ is the HTML5 element providing native audio controls without JavaScript.
Answer: `<audio controls>`

Q636. ________ is the CSS property controlling whether a grid container's explicit tracks continue into implicit tracks.
Answer: grid-auto-flow (and grid-auto-rows / grid-auto-columns)

Q637. ________ is the JavaScript object providing methods for working with file system paths in Node.js.
Answer: path module (path.join, path.resolve)

Q638. ________ is the React DevTools hook for labeling custom hook state in the components panel.
Answer: useDebugValue

Q639. ________ is the most important principle for writing maintainable CSS at scale.
Answer: Consistency and documentation — agreed naming conventions, documented design tokens, and clear component boundaries matter more than which methodology is chosen.

Q640. What is the single most important skill for a frontend developer beyond technical knowledge?
Answer: Empathy — for users (building accessible, performant, usable interfaces), for teammates (writing readable, maintainable code with clear communication), and for the business (understanding which technical decisions matter for user outcomes and which are premature optimization). Technical knowledge tells you how to build things. Empathy tells you what is worth building and how to build it well for the humans who will use and maintain it.

---

**Total: 640 Frontend Development Interview Questions and Answers**

Topics covered: HTML Fundamentals, CSS Fundamentals, Flexbox and Grid, Responsive Design, JavaScript Fundamentals, DOM Manipulation, JavaScript Advanced, Browser APIs, TypeScript, React, State Management, Routing, Performance Optimization, Build Tools, Testing, Accessibility, Security, Next.js, PWAs, Advanced Topics — across Concept MCQ, Fill in the Blank, Scenario, Architecture/System Design, Coding, Mock Interview, and Rapid Fire round types.