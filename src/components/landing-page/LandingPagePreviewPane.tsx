import { LandingPagePublicData } from "@/types/landing-page";
import { LandingPageTemplateCatalog } from "@/components/landing-page/templates/LandingPageTemplateCatalog";
import { LandingPageTemplateModern } from "@/components/landing-page/templates/LandingPageTemplateModern";

export function LandingPagePreviewPane({
  data,
  className = "",
}: {
  data: LandingPagePublicData;
  className?: string;
}) {
  const Template = data.template === "catalog" ? LandingPageTemplateCatalog : LandingPageTemplateModern;
  return (
    <div className={`overflow-hidden rounded-xl border bg-white ${className}`}>
      <div className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Pré-visualização do rascunho. O formulário não envia lead daqui.
      </div>
      <div className="h-[640px] overflow-hidden">
        <div className="pointer-events-none origin-top-left scale-[0.42] w-[238%]">
          <Template landingPage={data} />
        </div>
      </div>
    </div>
  );
}
