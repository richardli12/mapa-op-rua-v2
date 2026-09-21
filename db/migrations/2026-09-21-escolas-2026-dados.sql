-- ============================================================================
-- Carga das escolas municipais de Parauapebas -- base 2026
--
-- Rode DEPOIS de 2026-09-21-escolas-2026.sql, que cria as colunas novas.
-- E idempotente: rodar de novo so atualiza.
--
-- A BASE MUDOU DE NATUREZA, e nao so de numero. Antes era o Censo Escolar
-- 2025 inteiro -- 143 escolas, incluindo estaduais, privadas e a federal.
-- Agora e a base municipal de 2026: 82 escolas, todas da rede do
-- municipio. Por isso este arquivo tambem APAGA as escolas que nao estao
-- nesta lista: manter 2025 e 2026 lado a lado no mesmo mapa, sem distinguir,
-- faria qualquer soma mentir.
--
-- DUAS CONTAGENS, E ELAS NAO SAO A MESMA COISA:
--   . alunos_unicos -- a pessoa, contada uma vez so.
--   . matriculas    -- os vinculos; quem faz Fundamental e AEE conta duas.
-- Genero, faixa etaria e cor/raca somam ALUNOS UNICOS.
-- Tipo de ensino soma MATRICULAS.
-- Trocar um pelo outro e o erro facil desta base, e foi conferido linha a
-- linha na hora de gerar este arquivo.
--
-- DUAS LINHAS DA FONTE NAO FECHAM, e entram como vieram: em EMEF BEP TUM
-- XIKRIN e EMEF DOROTY STANG a soma dos tipos de ensino da uma matricula a
-- menos que o total informado. E divergencia da origem, de uma unidade em
-- cada, e nao foi "corrigida" aqui: inventar numero para fechar conta e pior
-- que mostrar a conta que nao fecha.
--
-- SEM COORDENADA: 8 escolas vieram sem latitude/longitude na fonte. Elas
-- entram assim mesmo, com o pino em NULL: os alunos delas contam nos totais e
-- nas listas, e o mapa simplesmente nao as desenha ate a coordenada chegar.
-- ============================================================================

insert into public.escolas (
  codigo_inep, nome, zona, dependencia, latitude, longitude,
  alunos_unicos, matriculas,
  mat_feminino, mat_masculino, mat_genero_nao_informado,
  mat_infantil, mat_fundamental, mat_eja, mat_aee,
  mat_0_3, mat_4_5, mat_6_10, mat_11_14, mat_15_17, mat_18_24, mat_25_mais,
  mat_idade_nao_informada,
  mat_branca, mat_preta, mat_parda, mat_amarela, mat_indigena,
  mat_indigena_xikrin, mat_albina, mat_raca_nao_declarada,
  mat_raca_nao_informada,
  etapas
) values
  ('15589234', 'CEPEJA I, 5º ao 8º Ano', 'Urbana', 'Municipal', -6.078465, -49.892718, 459, 459, 246, 211, 2, 0, 0, 459, 0, 1, 0, 0, 5, 147, 93, 210, 3, 53, 21, 298, 0, 1, 0, 0, 83, 3, array['Educação de Jovens e Adultos']::text[]),
  ('15166627', 'CEPEJA II CASTRO ALVES', 'Urbana', 'Municipal', -6.058477, -49.890018, 676, 676, 352, 324, 0, 0, 0, 676, 0, 0, 0, 0, 10, 275, 111, 280, 0, 53, 36, 404, 1, 1, 0, 0, 179, 2, array['Educação de Jovens e Adultos']::text[]),
  ('15174646', 'CEPEJA III RAQUEL SIRLENY CARDOSO BOTELHO', 'Urbana', 'Municipal', -6.118557, -49.903349, 468, 468, 219, 237, 12, 0, 0, 468, 0, 0, 0, 0, 4, 118, 60, 272, 14, 27, 53, 294, 1, 0, 0, 0, 75, 18, array['Educação de Jovens e Adultos']::text[]),
  ('15552489', 'E M E F 21 DE ABRIL', 'Rural', 'Municipal', -6.060644, -49.893923, 36, 36, 16, 20, 0, 8, 28, 0, 0, 0, 8, 27, 1, 0, 0, 0, 0, 5, 0, 17, 0, 2, 0, 0, 12, 0, array['Educação Infantil', 'Ensino Fundamental']::text[]),
  ('15125521', 'E M E F ALEGRIA DO SABER', 'Rural', 'Municipal', -5.917855, -50.353672, 250, 250, 131, 119, 0, 62, 188, 0, 0, 15, 47, 83, 97, 8, 0, 0, 0, 38, 3, 197, 0, 0, 0, 0, 12, 0, array['Educação Infantil', 'Ensino Fundamental']::text[]),
  ('15589242', 'E M E F ANTONIO MATOS FILHO', 'Urbana', 'Municipal', -6.091856, -49.892344, 894, 943, 438, 456, 0, 0, 894, 0, 49, 0, 1, 431, 440, 21, 1, 0, 0, 130, 39, 701, 2, 0, 0, 0, 22, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15125548', 'E M E F ANTONIO VILHENA', 'Rural', 'Municipal', -6.231106, -49.892752, 743, 770, 357, 386, 0, 127, 616, 0, 27, 0, 126, 343, 263, 11, 0, 0, 0, 78, 27, 619, 0, 0, 0, 0, 19, 0, array['Educação Infantil', 'Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15104141', 'E M E F BENEDITO MONTEIRO', 'Urbana', 'Municipal', -6.090932, -49.88348, 705, 744, 346, 359, 0, 0, 705, 0, 39, 1, 1, 399, 290, 14, 0, 0, 0, 117, 18, 438, 4, 2, 0, 0, 126, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15125653', 'E M E F CARLOS DRUMMOND DE ANDRADE', 'Urbana', 'Municipal', -6.078829, -49.890301, 951, 1000, 438, 513, 0, 0, 951, 0, 49, 0, 0, 562, 357, 32, 0, 0, 0, 163, 48, 725, 0, 2, 0, 0, 13, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15125815', 'E M E F CECILIA MEIRELES', 'Urbana', 'Municipal', -6.072317, -49.904013, 692, 728, 349, 343, 0, 0, 692, 0, 36, 0, 0, 324, 347, 21, 0, 0, 0, 118, 26, 444, 4, 6, 0, 0, 94, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15125823', 'E M E F CHICO MENDES II', 'Urbana', 'Municipal', -6.06547, -49.906195, 724, 752, 364, 360, 0, 0, 724, 0, 28, 0, 1, 269, 414, 39, 1, 0, 0, 89, 26, 377, 4, 8, 0, 0, 220, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15104168', 'E M E F DOMINGOS CARDOSO DA SILVA', 'Urbana', 'Municipal', -6.050228, -49.884975, 1472, 1549, 718, 754, 0, 0, 1471, 0, 78, 0, 0, 786, 630, 56, 0, 0, 0, 160, 41, 956, 0, 2, 0, 0, 313, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15576787', 'E M E F EDUARDO ANGELIM', 'Urbana', 'Municipal', -6.078643, -49.905214, 909, 974, 417, 492, 0, 0, 908, 0, 66, 0, 0, 507, 381, 21, 0, 0, 0, 126, 26, 630, 2, 2, 0, 0, 123, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15589307', 'E M E F EUNICE MOREIRA DOS SANTOS', 'Urbana', 'Municipal', -6.044617, -49.891087, 965, 1015, 444, 521, 0, 0, 964, 0, 51, 0, 0, 460, 462, 43, 0, 0, 0, 151, 32, 619, 2, 1, 0, 0, 160, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15125866', 'E M E F EURIDES SANTANA', 'Urbana', 'Municipal', -6.082919, -49.895922, 1084, 1132, 512, 572, 0, 0, 1084, 0, 48, 0, 0, 573, 476, 35, 0, 0, 0, 156, 40, 720, 5, 2, 1, 0, 160, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15568814', 'E M E F FARUK SALMEN', 'Urbana', 'Municipal', -6.090748, -49.888858, 967, 1046, 485, 482, 0, 0, 966, 0, 80, 0, 0, 486, 450, 31, 0, 0, 0, 202, 69, 650, 0, 0, 0, 0, 46, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15164675', 'E M E F FERNANDO PESSOA', 'Urbana', 'Municipal', -6.054272, -49.8744, 1057, 1114, 478, 579, 0, 0, 1057, 0, 57, 0, 0, 514, 507, 35, 1, 0, 0, 103, 46, 522, 3, 0, 0, 0, 383, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15138480', 'E M E F INDIGENA BEP KAROTI XIKRIN', 'Rural', 'Municipal', -6.260158, -50.80333, 185, 185, 115, 70, 0, 17, 122, 46, 0, 0, 17, 60, 50, 18, 12, 28, 0, 0, 1, 5, 0, 178, 0, 0, 1, 0, array['Educação Infantil', 'Ensino Fundamental', 'Educação de Jovens e Adultos']::text[]),
  ('15147169', 'E M E F INDIGENA MOIKO XIKRIN', 'Rural', 'Municipal', -6.310168, -50.906366, 255, 255, 147, 108, 0, 28, 133, 94, 0, 2, 26, 58, 45, 24, 30, 70, 0, 0, 0, 2, 0, 245, 1, 0, 7, 0, array['Educação Infantil', 'Ensino Fundamental', 'Educação de Jovens e Adultos']::text[]),
  ('15159574', 'E M E F IRMA LAURA', 'Urbana', 'Municipal', -6.10087, -49.885196, 761, 815, 352, 409, 0, 0, 761, 0, 54, 0, 1, 722, 38, 0, 0, 0, 0, 52, 23, 388, 2, 0, 0, 0, 296, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15526283', 'E M E F JEAN PIAGET', 'Urbana', 'Municipal', -6.082472, -49.907284, 1222, 1276, 637, 585, 0, 0, 1221, 0, 55, 0, 0, 700, 486, 36, 0, 0, 0, 106, 35, 625, 1, 2, 0, 0, 453, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15125998', 'E M E F JOAO PRUDENCIO DE BRITO', 'Urbana', 'Municipal', -6.061485, -49.916333, 416, 441, 199, 217, 0, 0, 415, 0, 26, 0, 0, 234, 177, 5, 0, 0, 0, 56, 16, 304, 3, 0, 0, 0, 37, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15126013', 'E M E F JORGE AMADO', 'Rural', 'Municipal', -5.960282, -50.102232, 210, 220, 102, 108, 0, 32, 178, 0, 10, 0, 33, 93, 73, 11, 0, 0, 0, 15, 6, 88, 0, 0, 0, 0, 101, 0, array['Educação Infantil', 'Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15125920', 'E M E F JOSE RODRIGUES DA SILVA', 'Rural', 'Municipal', -5.923894, -50.113147, 124, 124, 60, 64, 0, 25, 99, 0, 0, 0, 24, 49, 43, 8, 0, 0, 0, 8, 2, 112, 0, 0, 0, 0, 2, 0, array['Educação Infantil', 'Ensino Fundamental']::text[]),
  ('15589226', 'E M E F JOZIAS LEAO DA SILVA', 'Urbana', 'Municipal', -6.067101, -49.897737, 230, 241, 98, 132, 0, 0, 230, 0, 11, 0, 0, 134, 92, 4, 0, 0, 0, 28, 7, 161, 0, 0, 0, 0, 34, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15164314', 'E M E F LUIZ MAGNO DE ARAUJO', 'Urbana', 'Municipal', -6.07454, -49.871752, 799, 846, 375, 424, 0, 0, 799, 0, 47, 0, 0, 362, 419, 17, 1, 0, 0, 164, 42, 585, 4, 0, 0, 0, 4, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15159566', 'E M E F MACHADO DE ASSIS', 'Urbana', 'Municipal', -6.086279, -49.8931, 272, 297, 141, 131, 0, 0, 272, 0, 25, 0, 0, 265, 7, 0, 0, 0, 0, 45, 11, 129, 2, 0, 0, 0, 85, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15164349', 'E M E F MARIO LAGO', 'Urbana', 'Municipal', -6.123086, -49.903471, 1349, 1435, 668, 681, 0, 0, 1349, 0, 86, 0, 0, 1286, 63, 0, 0, 0, 0, 121, 42, 717, 5, 0, 0, 0, 464, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15164322', 'E M E F MILTON ALVES MARTINS', 'Urbana', 'Municipal', -6.10377, -49.83731, 1061, 1108, 496, 565, 0, 0, 1061, 0, 47, 0, 0, 29, 947, 84, 1, 0, 0, 89, 51, 746, 3, 0, 0, 0, 172, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15126137', 'E M E F MONTEIRO LOBATO', 'Rural', 'Municipal', -5.914027, -50.228788, 300, 300, 143, 157, 0, 73, 227, 0, 0, 27, 45, 129, 92, 5, 2, 0, 0, 36, 10, 253, 0, 0, 0, 0, 1, 0, array['Educação Infantil', 'Ensino Fundamental']::text[]),
  ('15164365', 'E M E F NELSON MANDELA', 'Urbana', 'Municipal', -6.033563, -49.889682, 1258, 1309, 608, 650, 0, 0, 1256, 0, 53, 0, 0, 14, 1193, 45, 2, 3, 1, 85, 40, 710, 2, 0, 0, 0, 421, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15576809', 'E M E F NOVO HORIZONTE', 'Urbana', 'Municipal', -6.061337, -49.894184, 1353, 1437, 679, 674, 0, 0, 1352, 0, 85, 0, 0, 698, 622, 33, 0, 0, 0, 178, 74, 1059, 6, 0, 0, 0, 36, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15526313', 'E M E F OLGA DA SILVA SOUSA', 'Urbana', 'Municipal', -6.053571, -49.889643, 1185, 1245, 610, 575, 0, 0, 1185, 0, 60, 0, 0, 651, 496, 38, 0, 0, 0, 161, 75, 924, 1, 0, 1, 0, 23, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15126277', 'E M E F PAULO FONTELES DE LIMA', 'Urbana', 'Municipal', -6.076637, -49.900728, 447, 448, 210, 237, 0, 0, 447, 0, 1, 0, 0, 57, 372, 18, 0, 0, 0, 54, 11, 186, 1, 0, 0, 0, 195, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15526330', 'E M E F PAULO FREIRE', 'Urbana', 'Municipal', -5.995742, -49.889202, 950, 992, 459, 491, 0, 0, 950, 0, 42, 0, 0, 787, 150, 12, 1, 0, 0, 147, 40, 707, 6, 0, 0, 0, 50, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15126315', 'E M E F PLACIDO DE CASTRO', 'Urbana', 'Municipal', -6.100373, -49.885963, 701, 726, 343, 358, 0, 0, 700, 0, 26, 0, 1, 14, 651, 34, 1, 0, 0, 85, 21, 506, 2, 0, 0, 0, 87, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15553574', 'E M E F SANTA TEREZA', 'Rural', 'Municipal', -6.071282, -49.888403, 98, 98, 38, 60, 0, 10, 88, 0, 0, 0, 10, 43, 40, 5, 0, 0, 0, 14, 4, 80, 0, 0, 0, 0, 0, 0, array['Educação Infantil', 'Ensino Fundamental']::text[]),
  ('15159558', 'E M E F TEREZINHA DE JESUS', 'Urbana', 'Municipal', -6.064247, -49.863936, 1495, 1597, 695, 800, 0, 0, 1493, 0, 104, 0, 0, 730, 709, 54, 1, 1, 0, 166, 58, 792, 4, 3, 0, 0, 472, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15583600', 'E M E F UNIAO DO POVO', 'Rural', 'Municipal', -6.076882, -49.892765, 52, 52, 23, 29, 0, 5, 47, 0, 0, 0, 5, 21, 22, 3, 1, 0, 0, 3, 0, 14, 0, 0, 0, 0, 35, 0, array['Educação Infantil', 'Ensino Fundamental']::text[]),
  ('15157873', 'E M E I ANA MARIA MACHADO', 'Urbana', 'Municipal', -6.088553, -49.888355, 206, 231, 105, 101, 0, 206, 0, 0, 25, 0, 206, 0, 0, 0, 0, 0, 0, 12, 0, 156, 1, 0, 0, 0, 37, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15574385', 'E M E I COMECINHO DE VIDA', 'Urbana', 'Municipal', -6.077003, -49.891098, 198, 198, 99, 99, 0, 198, 0, 0, 0, 51, 147, 0, 0, 0, 0, 0, 0, 51, 5, 139, 1, 0, 0, 0, 2, 0, array['Educação Infantil']::text[]),
  ('15164373', 'E M E I CORA CORALINA', 'Urbana', 'Municipal', -6.041413, -49.889377, 626, 697, 311, 315, 0, 626, 0, 0, 71, 0, 626, 0, 0, 0, 0, 0, 0, 114, 28, 483, 1, 0, 0, 0, 0, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15574423', 'E M E I DONA ROSA', 'Urbana', 'Municipal', -6.099894, -49.892428, 474, 519, 239, 235, 0, 474, 0, 0, 45, 115, 359, 0, 0, 0, 0, 0, 0, 77, 13, 382, 0, 0, 0, 0, 2, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15574393', 'E M E I FILOMENA R R FONSECA', 'Urbana', 'Municipal', -6.060493, -49.915051, 226, 253, 106, 120, 0, 225, 0, 0, 28, 51, 175, 0, 0, 0, 0, 0, 0, 56, 10, 150, 1, 0, 0, 0, 9, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15574415', 'E M E I GENTE INOCENTE', 'Urbana', 'Municipal', -6.093977, -49.887707, 247, 269, 134, 113, 0, 247, 0, 0, 22, 48, 199, 0, 0, 0, 0, 0, 0, 45, 12, 189, 0, 0, 0, 0, 1, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15102203', 'E M E I LEIDE MARIA TORRES FERREIRA', 'Urbana', 'Municipal', -6.062124, -49.891803, 229, 248, 110, 119, 0, 229, 0, 0, 19, 228, 1, 0, 0, 0, 0, 0, 0, 42, 21, 154, 0, 0, 0, 0, 12, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15589277', 'E M E I MARIA SALETE RIBEIRO MORENO', 'Rural', 'Municipal', -5.944283, -49.837233, 417, 443, 213, 204, 0, 417, 0, 0, 26, 118, 299, 0, 0, 0, 0, 0, 0, 74, 37, 299, 4, 2, 0, 1, 0, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15574369', 'E M E I MORANGUINHO', 'Urbana', 'Municipal', -6.079323, -49.896114, 385, 422, 187, 198, 0, 385, 0, 0, 37, 65, 320, 0, 0, 0, 0, 0, 0, 96, 18, 263, 0, 0, 0, 0, 8, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15589269', 'E M E I MUNDO INFANTIL', 'Urbana', 'Municipal', -5.99277, -49.891454, 419, 444, 206, 213, 0, 419, 0, 0, 25, 103, 316, 0, 0, 0, 0, 0, 0, 61, 8, 279, 0, 0, 0, 0, 71, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15574458', 'E M E I PEQUENO PRINCIPE', 'Urbana', 'Municipal', -6.073554, -49.906371, 174, 174, 83, 91, 0, 174, 0, 0, 0, 24, 149, 1, 0, 0, 0, 0, 0, 33, 4, 137, 0, 0, 0, 0, 0, 0, array['Educação Infantil']::text[]),
  ('15574431', 'E M E I PINGO DE GENTE', 'Urbana', 'Municipal', -6.085279, -49.880269, 288, 310, 138, 150, 0, 286, 0, 0, 24, 103, 185, 0, 0, 0, 0, 0, 0, 77, 8, 200, 0, 0, 0, 0, 3, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15160440', 'E M E I RUTH ROCHA', 'Urbana', 'Municipal', -6.076705, -49.854991, 798, 869, 371, 427, 0, 798, 0, 0, 71, 58, 740, 0, 0, 0, 0, 0, 0, 93, 14, 658, 4, 0, 0, 0, 29, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15574407', 'E M E I SORRISO DE CRIANCA', 'Urbana', 'Municipal', -6.079185, -49.90543, 283, 307, 138, 145, 0, 283, 0, 0, 24, 66, 217, 0, 0, 0, 0, 0, 0, 55, 12, 195, 3, 1, 0, 0, 17, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15574377', 'E M E I TURMA DA MONICA', 'Urbana', 'Municipal', -6.081983, -49.909065, 312, 312, 152, 160, 0, 312, 0, 0, 0, 1, 310, 1, 0, 0, 0, 0, 0, 30, 20, 154, 0, 0, 0, 0, 108, 0, array['Educação Infantil']::text[]),
  ('15579786', 'E M E I VOVO ANA', 'Urbana', 'Municipal', -6.050798, -49.891783, 288, 319, 146, 142, 0, 288, 0, 0, 31, 0, 287, 1, 0, 0, 0, 0, 0, 65, 6, 216, 0, 1, 0, 0, 0, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15157890', 'E M E I ZILDA ARNS', 'Urbana', 'Municipal', -6.044884, -49.890677, 137, 137, 66, 71, 0, 137, 0, 0, 0, 0, 137, 0, 0, 0, 0, 0, 0, 3, 1, 133, 0, 0, 0, 0, 0, 0, array['Educação Infantil']::text[]),
  ('15155994', 'E M T I CRESCENDO NA PRATICA', 'Rural', 'Municipal', -5.947476, -49.840595, 471, 485, 231, 240, 0, 0, 470, 0, 15, 0, 0, 8, 448, 14, 1, 0, 0, 65, 39, 327, 1, 1, 0, 0, 38, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15553582', 'E.M.E.F 18 DE OUTUBRO', 'Rural', 'Municipal', -5.968336, -49.892185, 166, 166, 72, 94, 0, 30, 136, 0, 0, 0, 30, 62, 68, 6, 0, 0, 0, 8, 1, 69, 0, 0, 0, 0, 88, 0, array['Educação Infantil', 'Ensino Fundamental']::text[]),
  ('15181251', 'E.M.E.F. JOSIANE SALAZAR', 'Urbana', 'Municipal', null, null, 1486, 1602, 710, 776, 0, 0, 1485, 0, 117, 0, 1, 1412, 72, 0, 0, 0, 1, 177, 77, 1101, 2, 0, 0, 0, 129, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15181260', 'E.M.E.F. MARIA JOSÉLIA DA SILVA OLIVEIRA', 'Urbana', 'Municipal', null, null, 1129, 1166, 531, 598, 0, 0, 1129, 0, 37, 0, 0, 4, 1076, 48, 0, 1, 0, 85, 53, 984, 2, 0, 0, 0, 5, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15174689', 'E.M.E.F. PROF. MARCELO RIMÉ VITALINO', 'Urbana', 'Municipal', -6.061239, -49.855104, 1381, 1435, 620, 761, 0, 0, 1380, 0, 55, 0, 0, 760, 589, 32, 0, 0, 0, 198, 75, 900, 3, 0, 0, 0, 205, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15174212', 'E.M.E.I AURINO GONÇALVES DOS SANTOS', 'Urbana', 'Municipal', -6.109759, -49.905545, 700, 751, 348, 352, 0, 700, 0, 0, 51, 157, 542, 1, 0, 0, 0, 0, 0, 116, 20, 560, 0, 0, 0, 0, 4, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15181219', 'E.M.T.I. JOSIANE SILVA', 'Urbana', 'Municipal', null, null, 95, 95, 52, 43, 0, 95, 0, 0, 0, 95, 0, 0, 0, 0, 0, 0, 0, 26, 10, 59, 0, 0, 0, 0, 0, 0, array['Educação Infantil']::text[]),
  ('15166619', 'EMEF BEP TUM XIKRIN', 'Rural', 'Municipal', -6.419118, -50.507863, 223, 224, 136, 87, 0, 30, 121, 72, 0, 8, 22, 48, 43, 21, 23, 58, 0, 1, 4, 0, 0, 213, 2, 0, 3, 0, array['Educação Infantil', 'Ensino Fundamental', 'Educação de Jovens e Adultos']::text[]),
  ('15164357', 'EMEF DOROTY STANG', 'Urbana', 'Municipal', -6.077567, -49.853202, 1606, 1724, 806, 800, 0, 0, 1604, 0, 119, 0, 0, 808, 766, 32, 0, 0, 0, 244, 62, 1271, 3, 2, 0, 0, 24, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15181235', 'EMEF ERAIDES SANTOS ARAUJO', 'Urbana', 'Municipal', null, null, 1383, 1449, 658, 725, 0, 0, 1383, 0, 66, 3, 0, 1313, 66, 1, 0, 0, 0, 180, 46, 1029, 3, 0, 0, 0, 125, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15166600', 'EMEF OZIEL ALVES PEREIRA', 'Rural', 'Municipal', -5.948439, -49.841197, 851, 877, 416, 435, 0, 0, 851, 0, 26, 0, 1, 721, 113, 16, 0, 0, 0, 76, 33, 468, 8, 4, 0, 0, 262, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15541347', 'EMEF SANDRA MARIA SANTOS DA SILVA', 'Urbana', 'Municipal', -6.090875, -49.867705, 385, 400, 192, 193, 0, 0, 385, 0, 15, 0, 0, 231, 139, 15, 0, 0, 0, 59, 27, 297, 0, 0, 0, 0, 2, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15174697', 'EMEF SANTA RITA DE CASSIA', 'Rural', 'Municipal', -6.425927, -51.123563, 70, 70, 30, 40, 0, 9, 61, 0, 0, 0, 9, 31, 26, 4, 0, 0, 0, 16, 7, 24, 0, 0, 0, 0, 23, 0, array['Educação Infantil', 'Ensino Fundamental']::text[]),
  ('15181200', 'EMEI FRANCISCA RODRIGUES DE MELO', 'Urbana', 'Municipal', null, null, 322, 348, 159, 163, 0, 322, 0, 0, 26, 0, 322, 0, 0, 0, 0, 0, 0, 42, 14, 265, 1, 0, 0, 0, 0, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15182622', 'EMEI MARIA JANETE BARBOSA NOGUEIRA LIMA', 'Urbana', 'Municipal', null, null, 197, 202, 79, 118, 0, 197, 0, 0, 5, 140, 57, 0, 0, 0, 0, 0, 0, 37, 9, 145, 1, 0, 0, 0, 5, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15181243', 'EMEI SULAMITA BRITO DA SILVA', 'Urbana', 'Municipal', null, null, 256, 276, 133, 123, 0, 256, 0, 0, 20, 96, 160, 0, 0, 0, 0, 0, 0, 42, 10, 180, 0, 0, 0, 0, 24, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15125670', 'EMTI CARLOS HENRIQUE', 'Urbana', 'Municipal', -6.078554, -49.887134, 332, 355, 151, 181, 0, 0, 332, 0, 23, 0, 0, 9, 312, 11, 0, 0, 0, 67, 15, 208, 0, 0, 0, 0, 42, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15167798', 'EMTI JOAO EVANGELISTA ARAUJO DE OLIVEIRA', 'Urbana', 'Municipal', -5.996729, -49.881246, 508, 520, 245, 263, 0, 0, 508, 0, 12, 0, 0, 15, 471, 21, 1, 0, 0, 59, 32, 376, 2, 0, 0, 0, 39, 0, array['Ensino Fundamental', 'Atendimento Educacional Especializado']::text[]),
  ('15176088', 'U.E.E.I DANIELE COSTA GALDINO', 'Urbana', 'Municipal', null, null, 657, 703, 305, 352, 0, 657, 0, 0, 46, 131, 526, 0, 0, 0, 0, 0, 0, 129, 27, 501, 0, 0, 0, 0, 0, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15573214', 'U.E.E.I DEYSE LORRENA', 'Urbana', 'Municipal', -6.092003, -49.864359, 388, 422, 202, 186, 0, 388, 0, 0, 34, 128, 260, 0, 0, 0, 0, 0, 0, 91, 16, 261, 0, 0, 0, 0, 20, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15176100', 'U.E.E.I ELONILDA DE OLIVEIRA', 'Urbana', 'Municipal', -6.097174, -49.85896, 190, 195, 98, 92, 0, 190, 0, 0, 5, 189, 0, 0, 0, 0, 1, 0, 0, 65, 9, 114, 1, 0, 0, 0, 1, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15175162', 'U.E.E.I JAKSON DE SOUZA E SILVA', 'Urbana', 'Municipal', -6.073555, -49.876987, 280, 310, 129, 151, 0, 280, 0, 0, 30, 135, 145, 0, 0, 0, 0, 0, 0, 97, 7, 148, 0, 1, 0, 0, 27, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15175154', 'U.E.E.I PASTOR JONAS BARROS DO AMARAL', 'Urbana', 'Municipal', -6.076438, -49.850886, 217, 225, 106, 111, 0, 217, 0, 0, 8, 217, 0, 0, 0, 0, 0, 0, 0, 29, 3, 84, 0, 0, 0, 0, 101, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15176096', 'U.E.E.I PROF. DALMO TENORIO NASCIMENTO PEREIRA', 'Urbana', 'Municipal', -6.051652, -49.883383, 429, 482, 198, 231, 0, 429, 0, 0, 53, 119, 310, 0, 0, 0, 0, 0, 0, 65, 28, 293, 0, 1, 0, 0, 42, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15170802', 'U.E.E.I RIBAMAR LEITE', 'Urbana', 'Municipal', -6.045926, -49.883113, 231, 253, 102, 129, 0, 231, 0, 0, 22, 231, 0, 0, 0, 0, 0, 0, 0, 49, 10, 172, 0, 0, 0, 0, 0, 0, array['Educação Infantil', 'Atendimento Educacional Especializado']::text[]),
  ('15172481', 'U.E.E.I. ZELITA PEREIRA DA SILVA', 'Urbana', 'Municipal', -6.082568, -49.909595, 270, 270, 133, 137, 0, 270, 0, 0, 0, 269, 1, 0, 0, 0, 0, 0, 0, 59, 15, 195, 0, 0, 0, 0, 1, 0, array['Educação Infantil']::text[])
on conflict (codigo_inep) do update set
  nome                     = excluded.nome,
  zona                     = excluded.zona,
  latitude                 = excluded.latitude,
  longitude                = excluded.longitude,
  alunos_unicos            = excluded.alunos_unicos,
  matriculas               = excluded.matriculas,
  mat_feminino             = excluded.mat_feminino,
  mat_masculino            = excluded.mat_masculino,
  mat_genero_nao_informado = excluded.mat_genero_nao_informado,
  mat_infantil             = excluded.mat_infantil,
  mat_fundamental          = excluded.mat_fundamental,
  mat_eja                  = excluded.mat_eja,
  mat_aee                  = excluded.mat_aee,
  mat_0_3                  = excluded.mat_0_3,
  mat_4_5                  = excluded.mat_4_5,
  mat_6_10                 = excluded.mat_6_10,
  mat_11_14                = excluded.mat_11_14,
  mat_15_17                = excluded.mat_15_17,
  mat_18_24                = excluded.mat_18_24,
  mat_25_mais              = excluded.mat_25_mais,
  mat_idade_nao_informada  = excluded.mat_idade_nao_informada,
  mat_branca               = excluded.mat_branca,
  mat_preta                = excluded.mat_preta,
  mat_parda                = excluded.mat_parda,
  mat_amarela              = excluded.mat_amarela,
  mat_indigena             = excluded.mat_indigena,
  mat_indigena_xikrin      = excluded.mat_indigena_xikrin,
  mat_albina               = excluded.mat_albina,
  mat_raca_nao_declarada   = excluded.mat_raca_nao_declarada,
  mat_raca_nao_informada   = excluded.mat_raca_nao_informada,
  etapas                   = excluded.etapas,
  dependencia              = 'Municipal',
  -- Colunas do censo antigo que esta base nao tem: zeradas de proposito.
  -- Deixar numero de 2025 do lado de numero de 2026 na mesma ficha e o jeito
  -- mais silencioso de mentir.
  situacao                 = null,
  restricao                = null,
  mat_creche               = null,
  mat_pre_escola           = null,
  mat_fund_iniciais        = null,
  mat_fund_finais          = null,
  mat_medio                = null,
  mat_profissional         = null,
  mat_eja_fundamental      = null,
  mat_eja_medio            = null,
  mat_especial             = null,
  mat_18_mais              = null,
  atualizado_em            = now();

-- A camada passa a ser exatamente esta lista. O que sobrou e base velha:
-- 2025, de outra rede, e sem par nesta carga.
delete from public.escolas
 where municipio = 'Parauapebas'
   and codigo_inep not in (
     '15589234', '15166627', '15174646', '15552489', '15125521', '15589242',
     '15125548', '15104141', '15125653', '15125815', '15125823', '15104168',
     '15576787', '15589307', '15125866', '15568814', '15164675', '15138480',
     '15147169', '15159574', '15526283', '15125998', '15126013', '15125920',
     '15589226', '15164314', '15159566', '15164349', '15164322', '15126137',
     '15164365', '15576809', '15526313', '15126277', '15526330', '15126315',
     '15553574', '15159558', '15583600', '15157873', '15574385', '15164373',
     '15574423', '15574393', '15574415', '15102203', '15589277', '15574369',
     '15589269', '15574458', '15574431', '15160440', '15574407', '15574377',
     '15579786', '15157890', '15155994', '15553582', '15181251', '15181260',
     '15174689', '15174212', '15181219', '15166619', '15164357', '15181235',
     '15166600', '15541347', '15174697', '15181200', '15182622', '15181243',
     '15125670', '15167798', '15176088', '15573214', '15176100', '15175162',
     '15175154', '15176096', '15170802', '15172481'
   );
