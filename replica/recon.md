# MusicCenter · Mapa funcional

**Referências Android e iOS · 20 de novembro de 2026**

Este mapa registra o recorte inicial. A versão atual é online, com gestão web, login obrigatório e um espaço compartilhado entre os dispositivos. A implementação atual está em [backend.md](backend.md).

O MusicCenter reúne a preparação do culto e a estante musical no mesmo aparelho. O público assumido para esta versão são dirigentes e músicos que preparam o roteiro, acompanham a escala e usam o próprio repertório no ensaio ou no palco.

## Fontes

Os nomes das duas pastas de `apks/` correspondem aos identificadores das fichas Android abaixo. O levantamento usa as descrições do fornecedor e os percursos publicados na central de ajuda. A versão exata dos pacotes locais é desconhecida. As capturas de referência podem ser consultadas nas fichas e nos guias. A pasta `replica/screens/` é reservada às referências visuais.

| ID | Fonte pública | Evidência usada |
| --- | --- | --- |
| R01 | [Services para Android](https://play.google.com/store/apps/details?id=com.ministrycentered.PlanningCenter) | Identificação de `com.ministrycentered.PlanningCenter`, edição de planos, escala, respostas e comunicação |
| R02 | [Music Stand para Android](https://play.google.com/store/apps/details?id=com.ministrycentered.musicstand) | Identificação de `com.ministrycentered.musicstand`, leitor de palco e controles de página |
| R03 | [Introdução ao Music Stand](https://help.planningcenter.com/en/140421-introduction-to-music-stand.html) | Percursos documentados separadamente para Android e iOS, seleção de plano, acesso ao repertório, PDFs e navegação |
| R04 | [Editar a ordem do culto](https://help.planningcenter.com/en/138508-edit-the-order-of-service.html) | Inserção de música, seleção do arranjo e tom, mudança de posição e edição |
| R05 | [Responder à escala](https://help.planningcenter.com/en/220672-accept-or-decline-scheduling-requests-in-music-stand.html) | Relação entre equipe, função e resposta. O percurso mostrado no Music Stand exige iOS e versão 6 ou posterior |
| R06 | [Usar o metrônomo](https://help.planningcenter.com/en/138509-use-the-metronome.html) | BPM, compasso, indicador de pulsação e andamento associado à música |
| R07 | [Music Stand para iPhone e iPad](https://apps.apple.com/us/app/planning-center-music-stand/id368561278) | Transposição de cifras, anotações, sessões sincronizadas e leitura offline |
| R08 | [Apresentação do Music Stand](https://www.planningcenter.com/music-stand) | Vínculo com Services, custos do complemento e origem das partituras |
| R09 | [Termos da Planning Center](https://www.planningcenter.com/terms) | A seção 4 restringe a descompilação, cópia e extração de conteúdo. A pesquisa foi feita pela documentação pública, sem acesso a contas |

## Fluxo central

O dirigente ordena as músicas do plano e registra os integrantes da escala. No ensaio, o músico abre esse mesmo plano, lê a cifra ou o PDF e acompanha o andamento. Usar o mesmo cadastro de música no repertório e no plano evita digitar o material duas vezes.

## Inventário funcional das referências

Cada ID representa uma tela ou painel com uma tarefa própria. Os estados desta tabela vêm das fontes indicadas. Campos obrigatórios, recuperação de falhas e situações de primeira execução do MusicCenter entram nos percursos abaixo como casos de projeto.

| ID | Tela | Acesso no original | Tarefa e componentes | Estados documentados |
| --- | --- | --- | --- | --- |
| S01 | Agenda de planos | Menu lateral → planos | Localizar a data para ensaio ou culto em uma lista | Planos da escala pessoal ou de uma pasta permitida (R03) |
| S02 | Ordem do culto | Selecionar a data | Ver o roteiro, consultar detalhes, adicionar e mover itens | Ordem preenchida, edição conforme permissão, seleção de arranjo quando há alternativas (R03, R04) |
| S03 | Escala do plano | Botão da equipe sob a data no Music Stand para iOS | Consultar nome, função e disponibilidade, aceitar ou recusar a solicitação | Pendente, aceita, recusada e integrante sem convocação (R05). Services oferece resposta no Android (R01) |
| S04 | Repertório | Menu lateral → músicas | Buscar pelo título, escolher a música e o arranjo | Lista e busca por título, acesso condicionado à permissão (R03) |
| S05 | Edição de letras e cifras | Ação de edição para usuários autorizados | Atualizar o texto musical de um arranjo | Edição para usuários com permissão, revisão do material (R03, R07) |
| S06 | Estante | Tocar em uma música da ordem ou escolher um PDF pelo repertório | Ler a folha e virar a página por toque ou gesto | Folha visível, barra de ferramentas oculta ou aberta, paisagem (R03) |
| S07 | Metrônomo | Ferramentas da estante → metrônomo | Ouvir a pulsação, ajustar o BPM e acompanhar o tempo | Tocando, parado, mudança de andamento ao trocar de música (R06) |
| S08 | Escolha de partitura | Seletor abaixo da música na ordem ou após escolher o arranjo no repertório | Identificar o arquivo correspondente ao instrumento | PDF selecionado ou escolha entre arquivos (R03) |

## Percursos

As contagens de toques usam as instruções públicas e o ponto de partida indicado. São estimativas dos originais. Uma escolha em lista, um gesto de arrastar ou um acionamento de controle contam como uma ação.

| ID | Objetivo e caminho | Ações na situação comum | Caso a considerar no MusicCenter |
| --- | --- | --- | --- |
| F01 | Abrir o roteiro a partir do menu fechado → S01 → S02 | 3, abrir menu, planos e data (R03) | Primeira abertura com agenda vazia, data sem plano |
| F02 | Incluir uma música e ajustar a posição no plano aberto → S02 → S04 → S02 | 3 no Android, abrir biblioteca, arrastar música de arranjo e tom únicos e ajustar posição (R04) | Reutilizar a música em mais de um plano, manter posições após reabrir |
| F03 | Registrar presença no plano aberto → S02 → S03 | 2 para confirmar uma função em equipe única no Music Stand para iOS (R05) | No MusicCenter a resposta fica no aparelho do responsável pela escala |
| F04 | Ler a partitura escolhida no plano e virar uma página → S02 → S06 | 2 com o PDF já selecionado (R03) | Item sem música, PDF indisponível, limite da primeira e última páginas |
| F05 | Consultar um PDF sem plano, a partir do menu fechado → S04 → S08 → S06 | 5, abrir menu, músicas, título, arranjo e arquivo (R03) | Busca sem resultados, leitura offline |
| F06 | Marcar o andamento a partir de uma cifra aberta → S06 → S07 | 3, revelar ferramentas, abrir metrônomo e tocar (R06) | BPM fora do intervalo, interrupção de áudio e troca de música |

## Componentes recorrentes

| Componente | Variações e estados | Telas |
| --- | --- | --- |
| Lista e seletor | Planos por data, músicas e arquivos, elemento selecionado | S01, S02, S04, S08 |
| Linha de música | Título, tom, posição no roteiro, abrir ou reorganizar | S02, S04 |
| Identificação de integrante | Nome e função, resposta indicada com texto e cor | S03 |
| Controle de edição | Abrir editor, alterar dados, confirmar alterações | S02, S05 |
| Barra de leitura | Visível ou recolhida, virar página e acessar ferramentas | S06, S07 |
| Controle de andamento | BPM, pulsação e alternância entre tocar e parar | S06, S07 |

## Modelo de dados inferido

As relações abaixo sintetizam o que aparece na experiência pública e orientam o aplicativo local. Os nomes dos campos são propostos.

| Entidade | Campos e relação | Indício e confiança |
| --- | --- | --- |
| Plano | ID, título, data. Contém itens ordenados e uma escala | S01–S03, R01 e R04. Alta |
| Item de plano | ID, plano, posição, descrição e referência opcional a uma música | S02 e R04. Alta para posição e vínculo com música. Média para os campos dos demais itens |
| Música | ID, título, tom, BPM e texto com cifras/letra | S04–S07, R03 e R06. Os originais distinguem arranjos. Um registro de música com um arranjo é uma simplificação local |
| Material musical | Identificador de arquivo e vínculo com a música. Um original pode reunir vários PDFs por arranjo | S06 e S08, R03. Alta para o vínculo. O mecanismo de armazenamento local depende da implementação |
| Participação na escala | Plano, pessoa, função e resposta | S03 e R05. Alta. No recorte local a pessoa pode ser identificada pelo nome informado em cada plano |

## Recorte e esforço

A [matriz de recursos](features.csv) relaciona cada capacidade à origem e à prioridade. A coluna `clone` registra o estado no MusicCenter. `skip` identifica conteúdo ou serviço de terceiros excluído.

O recorte prioriza planos e escala no aparelho, um repertório próprio e leitura em sequência no palco. Sessões sincronizadas entre músicos, convites por e-mail e edição simultânea dependem de identidade e de um serviço compartilhado. Catálogos comerciais dependem de licenças e contratos específicos. O aplicativo local recebe músicas e arquivos fornecidos pelo usuário.

O mapa cobre **8 telas ou painéis, 6 percursos e 5 entidades**. O porte estimado para o recorte local é **M**. Os três pontos de maior esforço são manter os PDFs disponíveis ao reabrir o app, conservar a posição correta ao alternar entre roteiro e leitura e sustentar a pulsação do metrônomo durante o uso. A validação em aparelho deve incluir interrupções de áudio, retorno do segundo plano e troca de orientação.
