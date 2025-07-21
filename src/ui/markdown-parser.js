import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { toString } from "mdast-util-to-string";

// Parse markdown content into an abstract syntax tree (AST)
export async function parseMarkdown(markdownContent) {
  try {
    // Create a unified processor with remark-parse
    const processor = unified().use(remarkParse);
    // Parse the markdown content into an AST
    const ast = processor.parse(markdownContent);
    // Run any transformations needed
    const result = await processor.run(ast);
    return result;
  } catch (e) {
    console.error("Error parsing markdown in markdown-parser.js:", e);
    throw e;
  }
}

// Replace multiple consecutive spaces, tabs,
// and newlines with a single space
function cleanText(text) { return text.replace(/\s+/g, " ").trim() }

// Get properly formatted text from the AST
export function getFormattedText(ast) {
  let text = "";

  // Process nodes to create proper paragraph breaks
  const processNode = (node) => {
    if (!node) return "";
    if (node.type === "root") {
      // Process each child node
      node.children.forEach((child, index) => {
        const childText = processNode(child);
        text += childText;
        // Add paragraph breaks between block elements
        if (
          index < node.children.length - 1 &&
          ["paragraph", "heading", "list"].includes(child.type)
        ) {  text += "\n\n" }
      });
      return text;
    }

    // Handle specific node types
    switch (node.type) {
      case "paragraph": return cleanText(toString(node));
      case "heading":   return cleanText(toString(node));
      case "list":
        let listText = "";
        node.children.forEach((item, index) => {
          // const marker = node.ordered ? `${index + 1}. ` : "• ";
          const itemText = cleanText(toString(item));
          // listText += marker + itemText;
          listText += itemText;
          if (index < node.children.length - 1) { listText += "\n" }
        });
        return listText;
      default:
        // For other node types, just return the text
        return cleanText(toString(node));
    }
  };
  return processNode(ast);
}

// Convert AST back to markdown string (for testing/debugging)
export async function astToMarkdown(ast) {
  try {
    const processor = unified().use(remarkStringify);
    const result = processor.stringify(ast);
    return result;
  } catch (e) {
    console.error("Error converting AST to markdown:", e);
    throw e;
  }
}

// Extract plain text from the AST
export function extractTextFromAst(ast) { return toString(ast) }

// Process markdown by parsing to AST + transforming for Adobe Express
export async function processMarkdown(markdownContent) {

  const ast = await parseMarkdown(markdownContent);
  // Extract all headings for potential TOC
  const headings = [];
  const processNode = (node) => {
    if (node.type === "heading") {
      headings.push({
        depth: node.depth, text: toString(node),
        children: node.children
      });
    }
    if (node.children) { node.children.forEach(processNode) }
  }
  processNode(ast);

  // Get both formatted text (with proper paragraphs) and raw text
  const formattedText = getFormattedText(ast);

  return { ast, headings, plainText: formattedText, formattedText }
}

export function extractRoadmapFromAst(ast) {
  const roadmap = {
    title: '',
    steps: []
  };

  let inStepsSection = false;

  for (let i = 0; i < ast.children.length; i++) {
    const node = ast.children[i];

    // Grab main title
    if (node.type === "heading" && node.depth === 1 && !roadmap.title) {
      roadmap.title = toString(node);
    }

    // Detect when we reach ## Steps section
    if (node.type === "heading" && node.depth === 2) {
      const headingText = toString(node).toLowerCase().trim();
      if (headingText === "steps") {
        inStepsSection = true;
        continue;
      } else if (inStepsSection) {
        break; // exit after Steps section ends
      }
    }

    // Parse each step in the Steps section
    if (inStepsSection && node.type === "heading" && node.depth === 3) {
      const stepTitle = toString(node);
      const bullets = [];

      // Look ahead for list node
      const next = ast.children[i + 1];
      if (next && next.type === "list") {
        next.children.forEach(item => {
          bullets.push(toString(item));
        });
        i++; // skip the list node in main loop
      }

      roadmap.steps.push({ title: stepTitle, bullets });
    }
  }

  return roadmap;
}
