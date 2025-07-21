import { parseMarkdown, extractRoadmapFromAst } from "./markdown-parser.js";
import {
  createExpressStylingFromAST
} from "./adobe-express-formatter.js";

// Sets up AI Prompt to Markdown functionality
export default function setupAiPromptHandler(sandboxProxy) {
  const aiPromptInput = document.getElementById("aiPromptInput");
  const markdownField = document.getElementById("markdownInput"); // Optional: textarea to show markdown
  const generateMarkdownBtn = document.getElementById("generateMarkdownBtn");
  const progressCircle = document.getElementById("progress-circle");

  if (!aiPromptInput || !generateMarkdownBtn) return;

  // Enable button only if there's text input
  aiPromptInput.addEventListener("input", () => {
    generateMarkdownBtn.disabled = aiPromptInput.value.trim().length === 0;
  });

  // Dummy AI markdown generator (simulates response)
  const dummyAiMarkdownGenerator = async (prompt) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`# How to Ride a Bicycle

## Steps

### 1. Get Set Up

* Check your brakes
* Adjust the seat

### 2. Start Pedaling

* Find an open, flat area
* Push off and start pedaling

### 3. Braking

* Practice braking slowly
* Avoid sudden stops
`);
      }, 1000); // Simulate network/AI delay
    });
  };

  const handleGenerateMarkdown = async () => {
    const prompt = aiPromptInput.value.trim();
    if (!prompt) {
      alert("Please enter a prompt");
      return;
    }

    generateMarkdownBtn.disabled = true;
    generateMarkdownBtn.textContent = "Generating...";
    if (progressCircle) progressCircle.style.display = "block";

    try {
      // Generate markdown text from prompt
      const markdown = await dummyAiMarkdownGenerator(prompt);

      // Optional: show markdown in UI
      if (markdownField) {
        markdownField.value = markdown;
      }

      // Parse markdown
      const ast = await parseMarkdown(markdown);

      // Convert AST into styled ranges (optional, useful for text nodes)
      const { plainText, styleRanges } = createExpressStylingFromAST(ast);

      // Extract roadmap structure
      const roadmap = extractRoadmapFromAst(ast);

      // Render roadmap into document
      await sandboxProxy.renderRoadmapFromParsedMarkdown(roadmap);
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      generateMarkdownBtn.disabled = false;
      generateMarkdownBtn.textContent = "Generate Roadmap";
      if (progressCircle) progressCircle.style.display = "none";
    }
  };

  generateMarkdownBtn.addEventListener("click", handleGenerateMarkdown);
}
