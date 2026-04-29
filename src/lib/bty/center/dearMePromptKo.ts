import type { DearMePromptType } from "@/engine/foundry/dear-me-recommender.service";

/** Bilingual prompt line above composer — product copy (Korean). */
export function getDearMePromptTextKo(promptType: DearMePromptType): string {
  switch (promptType) {
    case "first_letter":
      return "처음으로, 지금의 나에게 하고 싶은 말을 적어 보세요. 판단하지 말고 있는 그대로의 감정을 글로 남겨도 좋아요.";
    case "reflection_check":
      return "최근 2주간 마음에 남았던 장면이나 대화를 떠올리며, 그때의 나와 지금의 나를 짧게 연결해 보세요.";
    case "awakening_letter":
      return "새 출발이나 갱신을 떠올리며, 앞으로 나에게 바라는 한 가지를 구체적으로 적어 보세요.";
    case "none":
      return "지금 마음에 떠오르는 이야기를 자유롭게 적어 보세요.";
  }
}
