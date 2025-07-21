import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor, fonts, constants } from "express-document-sdk";
import { MD_CONSTANTS } from "./constants.js";

const { runtime } = addOnSandboxSdk.instance;
const DEBUG_STYLES = MD_CONSTANTS.DEBUG;

// Returns the font size for a specific markdown heading level
function getFontSizeForHeadingLevel(level) {
  return (
    MD_CONSTANTS.HEADING_SIZES[level] ||
    MD_CONSTANTS.HEADING_SIZES.DEFAULT
  );
}

// Initializes the document sandbox functionality
function start() {
  // Cache loaded fonts to avoid reloading them
  const fontCache = new Map();

  // Preloads and caches fonts by their postscript names
  async function preloadFonts(postscriptNames) {
    await Promise.all(
      postscriptNames.map(async (psName) => {
        const font = await fonts.fromPostscriptName(psName);
        if (font) { fontCache.set(psName, font) }
        else { console.warn(`Font ${psName} couldn't be loaded.`) }
      })
    );
  }

  // APIs to be exposed to the UI runtime
  const docApi = {
    // Creates a text node in the current document
    createTextNode: (text) => {
      try {
        // Find the current page
        let currentNode = editor.context.insertionParent;
        let page = null;
        while (currentNode) {
          if (currentNode.type === "Page") {
            page = currentNode; break;
          }
          currentNode = currentNode.parent;
        }

        // Create a new text node
        const textNode = editor.createText(text);
        console.log("textNode created", text);

        // Set the text content
        textNode.textAlignment = constants.TextAlignment.left;
        const artboard = page.artboards.first;
        textNode.layout = {
          type: constants.TextLayout.autoHeight,
          width: artboard.width - MD_CONSTANTS.LAYOUT.MARGIN_WIDTH,
        };
       

        // Position the text at the top-left corner and fill the page width
        textNode.setPositionInParent(
          { x: MD_CONSTANTS.LAYOUT.MARGIN, y: MD_CONSTANTS.LAYOUT.MARGIN },
          { x: 0, y: 0 }
        );

        console.log("textNode setPositionInParent");

        // Apply default character styles
        textNode.fullContent.applyCharacterStyles({
          fontSize: MD_CONSTANTS.LAYOUT.DEFAULT_FONT_SIZE,
        });
        console.log("textNode applyCharacterStyles");

        // Add to document
        artboard.children.append(textNode);
        console.log("textNode added to the artboard", textNode);
        return textNode;

      } catch (error) {
        console.error("Error creating text node:", error);
        throw error;
      }
    },

    // Creates a styled text node from markdown content
    createStyledTextFromMarkdown: async (markdownText, styleRanges) => {
      try {
        // Create text node first (this is allowed synchronously)
        const textNode = docApi.createTextNode(markdownText);

        // Preload fonts we'll need for styling
        await preloadFonts([
          MD_CONSTANTS.FONTS.HEADING, MD_CONSTANTS.FONTS.EMPHASIS,
          MD_CONSTANTS.FONTS.REGULAR, MD_CONSTANTS.FONTS.CODE,
        ]);

        // Get cached fonts
        const headingFont = fontCache.get(MD_CONSTANTS.FONTS.HEADING);
        const italicFont = fontCache.get(MD_CONSTANTS.FONTS.EMPHASIS);
        const boldFont = fontCache.get(MD_CONSTANTS.FONTS.STRONG);
        const monospaceFont = fontCache.get(MD_CONSTANTS.FONTS.CODE);

        // Now queue all style edits together for better performance
        await editor.queueAsyncEdit(async () => {
          for (const range of styleRanges) {
            if (DEBUG_STYLES) {
              console.log(`Applying ${range.style.type} style:`, range);
            }
            // Apply different styles based on the type
            if (range.style.type === "list") {
              docApi.applyListStyle(
                textNode, range.start, range.end, range.style.ordered
              );
            } else if (range.style.type === "heading") {
              if (DEBUG_STYLES) {
                console.log(
                  "Applying heading style for level:", range.style.level
                );
              }
              // Apply heading styles
              textNode.fullContent.applyCharacterStyles(
                {
                  font: headingFont,
                  fontSize: getFontSizeForHeadingLevel(range.style.level),
                },
                { start: range.start, length: range.end - range.start }
              );
              if (DEBUG_STYLES) {
                console.log("Applied heading style:", range.style.level);
              }
            } else if (range.style.type === "emphasis") {
              if (DEBUG_STYLES) {
                console.log("Applying emphasis style");
              }
              // Apply italic style
              textNode.fullContent.applyCharacterStyles(
                { font: italicFont },
                { start: range.start, length: range.end - range.start }
              );
              if (DEBUG_STYLES) {
                console.log("Applied emphasis style");
              }
            } else if (range.style.type === "strong") {
              if (DEBUG_STYLES) {
                console.log("Applying strong style");
              }
              // Apply bold style
              textNode.fullContent.applyCharacterStyles(
                { font: boldFont },
                { start: range.start, length: range.end - range.start }
              );
              if (DEBUG_STYLES) {
                console.log("Applied strong style");
              }
            } else if (range.style.type === "code") {
              if (DEBUG_STYLES) {
                console.log("Applying code style");
              }
              // Apply monospace font for code
              textNode.fullContent.applyCharacterStyles(
                { font: monospaceFont },
                { start: range.start, length: range.end - range.start }
              );
              if (DEBUG_STYLES) {
                console.log("Applied code style");
              }
            }
            // Add any additional styles here...
          }
          console.log("All styles applied");
        });
      } catch (error) {
        console.error("Error creating styled text from markdown:", error);
        throw error;
      }
    },

    // Applies ordered or unordered list styles to a text range
    applyListStyle: (textNode, start, end, ordered) => {
      try {
        const listType = ordered
          ? constants.ParagraphListType.ordered
          : constants.ParagraphListType.unordered;

        textNode.fullContent.applyParagraphStyles(
          {
            list: {
              type: listType,
              numbering: ordered
                ? constants.OrderedListNumbering.numeric
                : undefined,
              prefix: ordered
                ? MD_CONSTANTS.LIST.ORDERED_PREFIX
                : MD_CONSTANTS.LIST.UNORDERED_PREFIX,
              postfix: ordered
                ? MD_CONSTANTS.LIST.ORDERED_POSTFIX
                : MD_CONSTANTS.LIST.UNORDERED_POSTFIX,
              indentLevel: MD_CONSTANTS.LIST.DEFAULT_INDENT,
            },
            spaceBefore: MD_CONSTANTS.LAYOUT.PARAGRAPH_SPACE_BEFORE,
            spaceAfter: MD_CONSTANTS.LAYOUT.PARAGRAPH_SPACE_AFTER,
            lineSpacing: MD_CONSTANTS.LAYOUT.LINE_SPACING,
          },
          { start, length: end - start }
        );
      } catch (error) {
        console.error("Error applying list style:", error);
        throw error;
      }
    },
    renderRoadmapFromParsedMarkdown: async (parsed) => {
      const parent = editor.context.insertionParent;
      const boxWidth = (parent.width * 0.9) || 800;
      const boxHeight = 240;
      const spacingY = 300;
      let prevCenter = null;

      // STEP 1: Get canvas dimensions
      const canvasWidth = parent.width || 1080;  // fallback for safety
      const canvasHeight = parent.height || 1920;

      // STEP 2: Calculate roadmap dimensions
      const totalRoadmapHeight = parsed.steps.length * (boxHeight + spacingY);
      const totalRoadmapWidth = boxWidth;

      // STEP 3: Centering coordinates
      const startX = (canvasWidth - totalRoadmapWidth) / 2;
      let y = (canvasHeight - totalRoadmapHeight) / 4;

            
    
      // Main Title
      const titleNode = editor.createText(parsed.title);
     
      titleNode.translation = { x: canvasWidth/2 , y: 150 };
      //titleNode.textAlignment = constants.TextAlignment.center;
      titleNode.fullContent.applyCharacterStyles({ fontSize: 36 }, { start: 0, length: parsed.title.length });
      parent.children.append(titleNode);
    
      for (const step of parsed.steps) {
        const x = startX;
    
        const box = editor.createRectangle();
        box.width = boxWidth;
        box.height = boxHeight;
        box.translation = { x, y };
         

        box.fill = editor.makeColorFill({ red: 0.2, green: 0.5, blue: 0.9, alpha: 1 });
        parent.children.append(box);
    
        const stepTitle = editor.createText(step.title);
        //stepTitle.translation = { x: x + 100, y: y + 20 };

        stepTitle.fullContent.applyCharacterStyles({ fontSize: 28, color: { red: 1, green: 1, blue: 1, alpha: 1 } }, { start: 0, length: step.title.length });
        parent.children.append(stepTitle);
        stepTitle.setPositionInParent(
          {x: box.boundsInParent.x + 130 , y: box.boundsInParent.y + 50},
          { x: 0, y: 0 }
        );

        const bulletText = step.bullets.map(b => `• ${b}`).join('\n');
        const bullets = editor.createText(bulletText);
        bullets.translation = { x: x + boxWidth/2, y: y + 100 };
        
        bullets.fullContent.applyCharacterStyles({ fontSize: 22, color: { red: 1, green: 1, blue: 1, alpha: 1 } }, { start: 0, length: bulletText.length });
        parent.children.append(bullets);
        
        const center = { x: x + boxWidth / 2, y: y + boxHeight };
        if (prevCenter) {
          const line = editor.createLine();
          line.setEndPoints(prevCenter.x, prevCenter.y, center.x, y);
          line.stroke = editor.makeStroke({ color: { red: 0.2, green: 0.5, blue: 0.9, alpha: 1 }, width: 3 });
          parent.children.append(line);
        }
    
        prevCenter = { x: x + boxWidth / 2, y: y + boxHeight };
        y += spacingY;
      }
    }    
  };
  runtime.exposeApi(docApi);
}
start();
