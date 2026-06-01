import type { Tag } from "@/types/lead";

/** Resultado de `useTags().addTagToLead` — usado no funil sem acoplar ao hook. */
export type AddTagToLeadResult = {
  success: boolean;
  alreadyExists?: boolean;
  tagName?: string;
};

export type TagMutationOptions = {
  /** Funil: UI já validou lead/tag — uma única query insert/delete. */
  skipPreflight?: boolean;
};

/** API compartilhada no Kanban: uma instância de `useTags` para todos os cards. */
export type LeadOrgTagsPickerApi = {
  orgTags: Tag[];
  orgTagsLoading: boolean;
  addTagToLead: (
    leadId: string,
    tagId: string,
    options?: TagMutationOptions
  ) => Promise<AddTagToLeadResult>;
  removeTagFromLead: (
    leadId: string,
    tagId: string,
    options?: TagMutationOptions
  ) => Promise<boolean>;
  refetchOrgTags: () => void | Promise<void>;
};
