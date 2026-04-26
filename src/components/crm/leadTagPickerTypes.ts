import type { Tag } from "@/types/lead";

/** Resultado de `useTags().addTagToLead` — usado no funil sem acoplar ao hook. */
export type AddTagToLeadResult = {
  success: boolean;
  alreadyExists?: boolean;
  tagName?: string;
};

/** API compartilhada no Kanban: uma instância de `useTags` para todos os cards. */
export type LeadOrgTagsPickerApi = {
  orgTags: Tag[];
  orgTagsLoading: boolean;
  addTagToLead: (leadId: string, tagId: string) => Promise<AddTagToLeadResult>;
  removeTagFromLead: (leadId: string, tagId: string) => Promise<boolean>;
  refetchOrgTags: () => void | Promise<void>;
};
