export type FiscalErrorGuide = {
  title: string;
  reason: string;
  fix: string | null;
  unmapped: boolean;
};

type Entry = { prefix: string; title: string; fix: string | null };

const ENTRIES: Entry[] = [
  { prefix: "Informe a chave de 44 dígitos da NF-e referenciada", title: "A nota não foi emitida", fix: "No campo de referência, cole a chave somente com os 44 números." },
  { prefix: "Informe a chave de 44 dígitos da nota de origem", title: "A devolução não foi emitida", fix: "Cole a chave da nota de origem com os 44 números." },
  { prefix: "Informe a chave de 44 dígitos da NF-e", title: "A carta não foi enviada", fix: "Escolha a NF-e ou cole a chave com os 44 números." },
  { prefix: "Informações do produto faltando: Origem do produto", title: "A nota não foi emitida", fix: "No item, escolha a origem de 0 a 8." },
  { prefix: "Informações do produto faltando: Código NCM", title: "A nota não foi emitida", fix: "No item, preencha o NCM com 8 números." },
  { prefix: "Informações do produto faltando: Classe de imposto", title: "A nota não foi emitida", fix: "No item, escolha uma classe. As classes de produto ficam na aba Imposto de produto." },
  { prefix: "Informe a classe de imposto do produto", title: "A nota não foi emitida", fix: "No item, escolha uma classe. As classes de produto ficam na aba Imposto de produto." },
  { prefix: "Informe a classe de imposto do serviço", title: "A nota não foi emitida", fix: "No serviço, escolha uma classe. As classes de serviço ficam na aba Impostos de Serviços." },
  { prefix: "Informe o documento do cliente estrangeiro (5 a 20 caracteres)", title: "A nota não foi emitida", fix: "Com o cliente no exterior marcado, preencha o documento com 5 a 20 caracteres." },
  { prefix: "Informe o CPF ou CNPJ do cliente", title: "A nota não foi emitida", fix: "Preencha o CPF com 11 dígitos ou o CNPJ com 14. A NFC-e pode seguir sem esse documento." },
  { prefix: "Esta venda não tem serviço", title: "Não há o que emitir", fix: "Emita a nota do tipo que a venda tem." },
  { prefix: "Esta venda não tem produto", title: "Não há o que emitir", fix: "Emita a nota do tipo que a venda tem." },
  { prefix: "Configure a empresa do Agilize Total antes de emitir", title: "A nota não foi emitida", fix: "Na aba Alternar Empresa, informe o ID da empresa no Agilize Total." },
  { prefix: "Informe o ID da empresa no Agilize Total", title: "A empresa não foi salva", fix: "Na aba Alternar Empresa, informe o ID da empresa no Agilize Total." },
  { prefix: "Esse ID não existe no Agilize Total publicado nem na versão de desenvolvimento.", title: "A empresa não foi encontrada", fix: "Confira o ID na aba Alternar Empresa." },
  { prefix: "Empresa não encontrada no Agilize Total", title: "A empresa não foi encontrada", fix: "Confira o ID na aba Alternar Empresa." },
  { prefix: "Já existe uma nota deste tipo para esta origem", title: "A nota não foi emitida", fix: "Essa venda já tem uma nota deste tipo aprovada ou em processamento. Não emita de novo." },
  { prefix: "A nota não tem itens", title: "A nota não foi emitida", fix: "Inclua ao menos um produto ou serviço." },
  { prefix: "Informe o nome do cliente", title: "A nota não foi emitida", fix: "Preencha o nome do cliente." },
  { prefix: "NF-e precisa do endereço do cliente: logradouro, cidade, UF e CEP", title: "A nota não foi emitida", fix: "Preencha logradouro, cidade, UF e CEP." },
  { prefix: "Os serviços desta nota precisam da mesma classe de imposto", title: "A nota não foi emitida", fix: "Use a mesma classe de imposto em todos os serviços desta nota." },
  { prefix: "Origem do produto deve ser de 0 a 8", title: "A nota não foi emitida", fix: "Troque a origem do produto para um número de 0 a 8." },
  { prefix: "O motivo do cancelamento precisa ter de 15 a 255 caracteres", title: "A nota não foi cancelada", fix: "Escolha 1 - Erro na emissão, 2 - Serviço não prestado ou 4 - Duplicidade da nota." },
  { prefix: "Escolha o motivo do cancelamento", title: "A nota não foi cancelada", fix: "Escolha 1 - Erro na emissão, 2 - Serviço não prestado ou 4 - Duplicidade da nota." },
  { prefix: "O cancelamento de NFS-e usa o código numérico do motivo", title: "A nota não foi cancelada", fix: "Escolha 1 - Erro na emissão, 2 - Serviço não prestado ou 4 - Duplicidade da nota." },
  { prefix: "O cancelamento de NFS-e usa um destes motivos", title: "A nota não foi cancelada", fix: "Escolha 1 - Erro na emissão, 2 - Serviço não prestado ou 4 - Duplicidade da nota." },
  { prefix: "A NFS-e não tem o identificador da Webmania", title: "A nota não foi cancelada", fix: null },
  { prefix: "Informe o CFOP de devolução com 4 dígitos", title: "A devolução não foi emitida", fix: "Preencha o CFOP com 4 números." },
  { prefix: "A quantidade precisa acompanhar cada item devolvido", title: "A devolução não foi emitida", fix: "Informe uma quantidade para cada item." },
  { prefix: "Informe uma quantidade para cada item devolvido", title: "A devolução não foi emitida", fix: "Informe uma quantidade para cada item." },
  { prefix: "A correção precisa ter de 15 a 1000 caracteres", title: "A carta não foi enviada", fix: "Ajuste o texto da correção para ficar entre 15 e 1000 caracteres." },
  { prefix: "Cada imposto aceita até 6 cenários", title: "O cenário não foi incluído", fix: "Remova um cenário desse imposto antes de incluir outro." },
  { prefix: "ICMS não usa o cenário padrão", title: "O cenário não foi incluído", fix: "Escolha outro cenário para o ICMS." },
  { prefix: "Saída para o exterior aceita somente pessoa estrangeira", title: "O cenário não foi incluído", fix: "Na saída para o exterior, deixe o tipo de pessoa como estrangeira." },
  { prefix: "Pessoa estrangeira só vale na saída para o exterior", title: "O cenário não foi incluído", fix: "Use pessoa estrangeira somente no cenário de saída para o exterior." },
  { prefix: "Informe a alíquota de importação do ICMS", title: "O cenário não foi incluído", fix: "Preencha a alíquota de importação do ICMS." },
  { prefix: "A classificação tributária do IBS/CBS tem 6 dígitos", title: "O cenário não foi incluído", fix: "Preencha a classificação tributária com 6 números." },
  { prefix: "A Webmania não devolveu a referência da classe de imposto", title: "A classe não foi salva", fix: null },
  { prefix: "A classe foi salva na Webmania, mas não apareceu no Agilize Total", title: "Classe salva na Webmania", fix: null },
  { prefix: "Não foi possível ler o espelho de classes do Agilize Total", title: "O espelho não foi lido", fix: null },
  { prefix: "Esta nota já está cancelada", title: "A nota não foi cancelada", fix: null },
  { prefix: "A nota não tem chave nem identificador da Webmania", title: "A nota não foi cancelada", fix: null },
  { prefix: "Nota sem identificador da Webmania", title: "A nota não foi consultada", fix: null },
  { prefix: "Só é possível excluir rascunho ou nota ainda não autorizada", title: "A nota não foi excluída", fix: null },
  { prefix: "A Webmania recusou a emissão", title: "A nota não foi emitida", fix: null },
  { prefix: "A Webmania recusou a devolução", title: "A devolução não foi emitida", fix: null },
  { prefix: "A Webmania recusou o cancelamento", title: "A nota não foi cancelada", fix: null },
  { prefix: "A Webmania recusou a carta de correção", title: "A carta não foi enviada", fix: null },
  { prefix: "A Webmania recusou a classe de imposto", title: "A classe não foi salva", fix: null },
  { prefix: "Falha ao consultar a nota", title: "A nota não foi consultada", fix: null },
  { prefix: "Falha ao consultar", title: "A nota não foi consultada", fix: null },
  { prefix: "Não autenticado", title: "Sessão encerrada", fix: "Entre de novo na sua conta." },
  { prefix: "Token inválido", title: "Sessão encerrada", fix: "Entre de novo na sua conta." },
  { prefix: "Usuário sem organização", title: "Sessão encerrada", fix: "Entre de novo na sua conta." },
  { prefix: "Sem acesso a esta organização", title: "Sessão encerrada", fix: "Entre de novo na sua conta." },
  { prefix: "Nota não encontrada", title: "A nota não foi encontrada", fix: null },
  { prefix: "Venda não encontrada", title: "A venda não foi encontrada", fix: null },
  { prefix: "Venda não informada", title: "A venda não foi encontrada", fix: null },
  { prefix: "Ordem de serviço não encontrada", title: "A ordem não foi encontrada", fix: null },
  { prefix: "Ordem não informada", title: "A ordem não foi encontrada", fix: null },
  { prefix: "Informe a classe", title: "A classe não foi excluída", fix: null },
  { prefix: "Falha na nota fiscal", title: "A nota não foi emitida", fix: null },
  { prefix: "Falha na classe de imposto", title: "A classe não foi salva", fix: null },
  { prefix: "Falha ao emitir", title: "A nota não foi emitida", fix: null },
  { prefix: "Falha ao cancelar", title: "A nota não foi cancelada", fix: null },
  { prefix: "Falha na devolução", title: "A devolução não foi emitida", fix: null },
  { prefix: "Falha na carta de correção", title: "A carta não foi enviada", fix: null },
  { prefix: "Não foi possível excluir", title: "Não foi possível excluir", fix: null },
  { prefix: "Não foi possível salvar a classe", title: "A classe não foi salva", fix: null },
  { prefix: "Não foi possível gravar o produto", title: "O produto não foi atualizado", fix: null },
  { prefix: "Não foi possível listar as classes", title: "As classes não foram listadas", fix: null },
  { prefix: "Não foi possível listar as vendas", title: "As vendas não foram listadas", fix: null },
  { prefix: "Não foi possível tirar as vendas da lista", title: "A venda continua na lista", fix: null },
  { prefix: "Não foi possível abrir a emissão", title: "A emissão não abriu", fix: null },
  { prefix: "Erro ao salvar", title: "A empresa não foi salva", fix: null },
  { prefix: "Webmania respondeu", title: "Retorno da Webmania", fix: null },
  { prefix: "Agilize Total respondeu", title: "Retorno do Agilize Total", fix: null },
];

export function explainFiscalError(message: string): FiscalErrorGuide {
  const reason = message.trim();
  if (!reason) return { title: "A nota não foi aceita", reason: "", fix: null, unmapped: false };
  if (/erro não catalogado/i.test(reason)) {
    return {
      title: "A nota não foi cancelada",
      reason,
      fix: "A Secretaria da Fazenda recusou sem dizer qual regra falhou. A nota continua autorizada. Não há outro motivo escondido nesse retorno.",
      unmapped: false,
    };
  }
  if (/portal da prefeitura|portal nacional/i.test(reason)) {
    return {
      title: "A classe de serviço não foi criada",
      reason,
      fix: "Configure o login do Portal da Prefeitura ou do Portal Nacional (MEI) na Webmania. Sem esse login, a classe não é criada no Flow nem no Agilize Total.",
      unmapped: false,
    };
  }
  const found = ENTRIES.find((entry) => reason.startsWith(entry.prefix));
  if (found) return { title: found.title, reason, fix: found.fix, unmapped: false };
  if (reason.includes("Agilize Total")) return { title: "Retorno do Agilize Total", reason, fix: null, unmapped: false };
  return { title: "A nota não foi aceita", reason, fix: null, unmapped: true };
}
