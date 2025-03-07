import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";

// Define the ProjectManagerState
const ProjectManagerState = Annotation.Root({
  input: Annotation<string>({ reducer: (x, y) => y ?? x ?? "" }),
  plan: Annotation<string[]>({ reducer: (x, y) => y ?? x ?? [] }),
  pastSteps: Annotation<[string, string][]>({ reducer: (x, y) => x.concat(y) }),
  response: Annotation<string>({ reducer: (x, y) => y ?? x }),
});

// Define Planner and Re-Planner Prompts
const plannerPrompt = ChatPromptTemplate.fromTemplate(
  `For the selected VA form filing, provide a step-by-step plan to collect necessary information for submission. Task: {task}`
);

const replannerPrompt = ChatPromptTemplate.fromTemplate(
  `Objective: {input}
   Original Plan: {plan}
   Completed Steps: {pastSteps}
   
   Update the plan if any steps remain. If all steps are complete, confirm submission.`,
);

// Initialize LLMs without structured output
const plannerLLM = new ChatOpenAI({ model: "gpt-4" });
const replannerLLM = new ChatOpenAI({ model: "gpt-4" });

const planner = plannerPrompt.pipe(plannerLLM);
const replanner = replannerPrompt.pipe(replannerLLM);

// Define the Plan Step, ensuring output.content is converted to a string
async function planStep(
  state: typeof ProjectManagerState.State,
): Promise<Partial<typeof ProjectManagerState.State>> {
  const output = await planner.invoke({ task: state.input });
  
  // Ensure output.content is a string
  const content = Array.isArray(output.content)
    ? JSON.stringify(output.content)
    : output.content.toString();

  console.log("Planner Output:", content);
  return { plan: [content] };
}

// Define the Re-Plan Step, ensuring output.content is converted to a string
async function replanStep(
  state: typeof ProjectManagerState.State,
): Promise<Partial<typeof ProjectManagerState.State>> {
  const output = await replanner.invoke({
    input: state.input,
    plan: state.plan.join("\n"),
    pastSteps: state.pastSteps
      .map(([step, result]) => `${step}: ${result}`)
      .join("\n"),
  });

  // Ensure output.content is a string
  const content = Array.isArray(output.content)
    ? JSON.stringify(output.content)
    : output.content.toString();

  console.log("Replanner Output:", content);
  return { plan: [content] };
}

// Define the Execution Step
const agentExecutor = createReactAgent({
  llm: plannerLLM,
  tools: [],
});

async function executeStep(
  state: typeof ProjectManagerState.State,
  config?: RunnableConfig,
): Promise<Partial<typeof ProjectManagerState.State>> {
  const task = state.plan[0];
  const input = { messages: [new HumanMessage(task)] };
  const { messages } = await agentExecutor.invoke(input, config);

  return {
    pastSteps: [[task, messages[messages.length - 1].content.toString()]],
    plan: state.plan.slice(1),
  };
}

// Function to Check if Workflow Should End
function shouldEnd(state: typeof ProjectManagerState.State) {
  return state.plan.length === 0 ? "true" : "false";
}

// Create the Graph Workflow
const workflow = new StateGraph(ProjectManagerState)
  .addNode("planner", planStep)
  .addNode("agent", executeStep)
  .addNode("replan", replanStep)
  .addEdge(START, "planner")
  .addEdge("planner", "agent")
  .addEdge("agent", "replan")
  .addConditionalEdges("replan", shouldEnd, {
    true: END,
    false: "agent",
  });

// Compile the Workflow
const app = workflow.compile();

async function runProjectManager(task: string): Promise<any> {
  const inputs = { input: task };
  const results = [];

  for await (const event of await app.stream(inputs, { recursionLimit: 50 })) {
    console.log(event);
    results.push(event); // Collect the output for the API response
  }

  return results; // Return the accumulated results
}

export { runProjectManager };