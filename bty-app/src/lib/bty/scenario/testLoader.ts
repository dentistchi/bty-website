import { loadScenario } from './loader';

async function testLoadScenario() {
  try {
    const scenario = await loadScenario("core_04_manager_neutrality_as_abandonment", "en");
    console.log("Title:", scenario.title);
    console.log("Choices:", scenario.choices);
    scenario.choices.forEach(choice => {
      if (!choice.dbChoiceId) {
        throw new Error(`Missing dbChoiceId for choiceId ${choice.id}`);
      }
    });
    console.log("All dbChoiceId are present.");
  } catch (error) {
    console.error("Error loading scenario:", error);
  }
}

testLoadScenario();
