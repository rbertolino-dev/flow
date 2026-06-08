import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Lead } from "@/types/lead";
import { LeadBudgetBadge } from "./LeadBudgetBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Phone, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const ROW_HEIGHT_PX = 56;
const VIRTUAL_OVERSCAN = 8;
const VIRTUALIZE_THRESHOLD = 25;

interface VirtualizedStageLeadRowsProps {
  stageLeads: Lead[];
  selectedLeads: Set<string>;
  onLeadSelect: (leadId: string) => void;
  onLeadClick: (lead: Lead) => void;
  onWhatsAppClick: (phone: string) => void;
  onPhoneClick: (phone: string) => void;
  onScheduleClick: (lead: Lead) => void;
  /** true = tabela completa com cabeçalho (etapas com 25+ leads). */
  standalone?: boolean;
}

function StageLeadRow({
  lead,
  selectedLeads,
  onLeadSelect,
  onLeadClick,
  onWhatsAppClick,
  onPhoneClick,
  onScheduleClick,
  rowRef,
  rowStyle,
  rowClassName,
}: {
  lead: Lead;
  selectedLeads: Set<string>;
  onLeadSelect: (leadId: string) => void;
  onLeadClick: (lead: Lead) => void;
  onWhatsAppClick: (phone: string) => void;
  onPhoneClick: (phone: string) => void;
  onScheduleClick: (lead: Lead) => void;
  rowRef?: (node: HTMLTableRowElement | null) => void;
  rowStyle?: React.CSSProperties;
  rowClassName?: string;
}) {
  return (
    <TableRow
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "cursor-pointer hover:bg-muted/50",
        selectedLeads.has(lead.id) && "bg-muted/30",
        rowClassName
      )}
      onClick={() => onLeadClick(lead)}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selectedLeads.has(lead.id)}
          onCheckedChange={() => onLeadSelect(lead.id)}
        />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <LeadBudgetBadge summary={lead.budgetSummary} compact />
            <span className="font-medium">{lead.name}</span>
            {lead.has_unread_messages && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {lead.unread_message_count}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground sm:hidden">{lead.phone}</span>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-sm">{lead.phone}</TableCell>
      <TableCell className="hidden md:table-cell text-sm">
        {lead.returnDate ? (
          <Badge variant="outline">
            {new Date(lead.returnDate).toLocaleDateString("pt-BR")}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm">
        {lead.sourceInstanceName || lead.source || "-"}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm">
        {lead.value ? (
          <span className="font-medium">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(Number(lead.value))}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
        {lead.lastContact
          ? formatDistanceToNow(new Date(lead.lastContact), {
              addSuffix: true,
              locale: ptBR,
            })
          : "-"}
      </TableCell>
      <TableCell className="hidden 2xl:table-cell text-sm text-muted-foreground max-w-xs">
        {lead.notes ? (
          <p className="line-clamp-2">{lead.notes}</p>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onWhatsAppClick(lead.phone)}
            title="Abrir WhatsApp"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPhoneClick(lead.phone)}
            title="Ligar"
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onScheduleClick(lead)}
            title="Agendar"
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function StageTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-12"></TableHead>
        <TableHead>Nome</TableHead>
        <TableHead className="hidden sm:table-cell">Telefone</TableHead>
        <TableHead className="hidden md:table-cell">Data de Retorno</TableHead>
        <TableHead className="hidden lg:table-cell">Origem</TableHead>
        <TableHead className="hidden lg:table-cell">Valor</TableHead>
        <TableHead className="hidden xl:table-cell">Último Contato</TableHead>
        <TableHead className="hidden 2xl:table-cell">Observações</TableHead>
        <TableHead className="text-right">Ações</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function VirtualizedStageLeadRows(props: VirtualizedStageLeadRowsProps) {
  const { stageLeads, standalone = false } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const useVirtual = stageLeads.length >= VIRTUALIZE_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: useVirtual ? stageLeads.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: VIRTUAL_OVERSCAN,
  });

  if (!useVirtual) {
    return (
      <TableBody>
        {stageLeads.map((lead) => (
          <StageLeadRow key={lead.id} lead={lead} {...props} />
        ))}
      </TableBody>
    );
  }

  const virtualBody = (
    <TableBody
      style={{
        height: rowVirtualizer.getTotalSize(),
        position: "relative",
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const lead = stageLeads[virtualRow.index];
        return (
          <StageLeadRow
            key={lead.id}
            lead={lead}
            {...props}
            rowRef={rowVirtualizer.measureElement}
            rowStyle={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        );
      })}
    </TableBody>
  );

  if (standalone) {
    return (
      <div
        ref={scrollRef}
        className="max-h-[min(60dvh,520px)] overflow-y-auto [contain:layout_style]"
      >
        <Table>
          <StageTableHeader />
          {virtualBody}
        </Table>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-[min(60dvh,520px)] overflow-y-auto [contain:layout_style]"
    >
      <Table>{virtualBody}</Table>
    </div>
  );
}
