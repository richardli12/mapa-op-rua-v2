import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Camera,
  Link2,
  Loader2,
  Plus,
  QrCode,
  Search,
  Trash2,
  X
} from 'lucide-react';
import QRCode from 'qrcode';
import { DatabaseService } from '../databaseClient';
import { Candidate } from '../types';

/**
 * Endereço do cadastro pelo QR Code.
 *
 * O cadastro mora num domínio separado do painel: quem lê o QR Code nunca vê o
 * endereço da área administrativa. Sem a variável configurada, o link volta a
 * apontar para o próprio endereço aberto, que é o que serve em desenvolvimento.
 */
const BASE_CADASTRO = (
  (import.meta as any).env?.VITE_SIGNUP_BASE_URL ||
  'https://cadastro.657169.74696d656f7065726163696f6e616c63636f.online'
).replace(/\/$/, '');

type Aviso = (texto: string, tipo?: 'success' | 'error' | 'info') => void;

/** Prazos que o ADM pode escolher para o QR Code. */
const PRAZOS = [
  { minutos: 2, label: '2 minutos' },
  { minutos: 5, label: '5 minutos' },
  { minutos: 10, label: '10 minutos' },
  { minutos: 30, label: '30 minutos' },
  { minutos: 60, label: '1 hora' },
  { minutos: 60 * 24, label: '24 horas' },
  { minutos: 60 * 24 * 7, label: '7 dias' }
];

const rotuloPrazo = (min: number) =>
  PRAZOS.find(p => p.minutos === min)?.label || `${min} minutos`;

interface BaseProps {
  client: Candidate;
  onClose: () => void;
  onChanged: () => void;
  notify: Aviso;
}

const caixa =
  'bg-white rounded-3xl w-full shadow-3xl overflow-hidden border border-slate-100 font-sans flex flex-col max-h-[90vh]';
const fundo =
  'fixed inset-0 bg-[#0c1322]/40 backdrop-blur-xs flex items-center justify-center z-[12000] p-4';
const input =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500';

function Cabecalho({
  titulo,
  subtitulo,
  onClose
}: {
  titulo: string;
  subtitulo: string;
  onClose: () => void;
}) {
  return (
    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
      <div>
        <h3 className="text-lg font-black text-slate-800">{titulo}</h3>
        <p className="text-[10px] uppercase tracking-widest text-[#8492A6] font-bold mt-0.5">
          {subtitulo}
        </p>
      </div>
      <button
        onClick={onClose}
        className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

/* ========================================================================== */
/* 1. VINCULAR MEMBRO EXISTENTE                                               */
/* ========================================================================== */
/**
 * Traz para este cliente alguém que já está cadastrado em outro.
 *
 * O cadastro original não se move: é criada uma ficha própria na equipe deste
 * cliente, porque cada cliente enxerga só a sua equipe.
 */
export function VincularMembroModal({
  client,
  onClose,
  onChanged,
  notify,
  allMembers
}: BaseProps & { allMembers: any[] }) {
  const [busca, setBusca] = useState('');
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const jaNaEquipe = new Set(
    allMembers
      .filter(m => m.candidate_id === client.id)
      .map(m => (m.whatsapp || '').replace(/\D/g, ''))
  );

  const q = busca.trim().toLowerCase();
  const candidatosAoVinculo = allMembers
    .filter(m => m.candidate_id !== client.id)
    .filter(m => {
      if (!q) return true;
      return (
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.whatsapp || '').includes(q)
      );
    });

  const vincular = async (membro: any) => {
    setSalvandoId(membro.id);
    const res = await DatabaseService.upsertSupporter({
      id: '',
      full_name: membro.full_name,
      whatsapp: membro.whatsapp,
      candidate_id: client.id,
      image: membro.image,
      extra_fields: membro.extra_fields,
      source: 'vinculado'
    });
    setSalvandoId(null);
    if (!res.success) {
      notify(`Não foi possível vincular: ${res.error || 'erro'}`, 'error');
      return;
    }
    notify(`${membro.full_name} agora faz parte desta equipe.`, 'success');
    onChanged();
  };

  return (
    <div className={fundo}>
      <div className={`${caixa} max-w-xl`}>
        <Cabecalho
          titulo="Vincular Integrante"
          subtitulo={`Para a equipe de ${client.name}`}
          onClose={onClose}
        />

        <div className="px-6 py-4 border-b border-slate-100">
          <div className="relative bg-slate-50 border border-slate-200 rounded-2xl flex items-center px-4 h-11">
            <Search className="w-4 h-4 text-slate-400 mr-2.5" />
            <input
              autoFocus
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="bg-transparent border-none w-full text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
          {candidatosAoVinculo.length === 0 ? (
            <p className="py-14 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
              Nenhum integrante disponível para vincular
            </p>
          ) : (
            candidatosAoVinculo.map(m => {
              const telefone = (m.whatsapp || '').replace(/\D/g, '');
              const repetido = jaNaEquipe.has(telefone);
              return (
                <div
                  key={m.id}
                  className="border border-slate-200 rounded-2xl p-3 flex items-center gap-3 hover:border-emerald-200 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {m.image ? (
                      <img src={m.image} alt={m.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[11px] font-black text-slate-500">
                        {(m.full_name || '?').substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-slate-800 text-sm truncate">
                      {m.full_name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-bold font-mono">
                      {m.whatsapp}
                    </p>
                  </div>
                  <button
                    disabled={repetido || salvandoId === m.id}
                    onClick={() => vincular(m)}
                    className={`px-4 h-9 text-[11px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shrink-0 transition-all ${
                      repetido
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                    }`}
                  >
                    {repetido ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Já está
                      </>
                    ) : salvandoId === m.id ? (
                      'Salvando...'
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" />
                        Vincular
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 2. QR CODE DE USO ÚNICO                                                    */
/* ========================================================================== */
export function QrConviteModal({ client, onClose, notify }: BaseProps) {
  const [convites, setConvites] = useState<any[]>([]);
  const [nota, setNota] = useState('');
  /** Prazo de validade escolhido pelo ADM, em minutos. */
  const [minutos, setMinutos] = useState(10);
  const [gerando, setGerando] = useState(false);
  /** Relógio do modal, para a contagem dos convites andar sozinha. */
  const [agora, setAgora] = useState(() => Date.now());
  const [ativo, setAtivo] = useState<any>(null);
  const [imagemQr, setImagemQr] = useState('');

  const carregar = async () => {
    const res = await DatabaseService.fetchTeamInvites(client.id);
    if (res.success) setConvites(res.data);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /**
   * Link do convite.
   *
   * O token vai depois do `#`, e não como `?convite=`. O que vem depois do `#`
   * nunca é enviado ao servidor: não entra em log de acesso, não vaza no
   * cabeçalho Referer e não chega aos robôs que montam a pré-visualização de
   * link. Aberta a página, o endereço na barra é limpo e sobra só o domínio.
   */
  const linkDe = (token: string) => `${BASE_CADASTRO}/#c=${token}`;

  useEffect(() => {
    if (!ativo) return setImagemQr('');
    QRCode.toDataURL(linkDe(ativo.token), { width: 320, margin: 1 })
      .then(setImagemQr)
      .catch(() => setImagemQr(''));
  }, [ativo]);

  const gerar = async () => {
    setGerando(true);
    const res = await DatabaseService.createTeamInvite(
      client.id,
      nota.trim(),
      minutos,
    );
    setGerando(false);
    if (!res.success || !res.data) {
      notify(`Não foi possível gerar: ${res.error || 'erro'}`, 'error');
      return;
    }
    setNota('');
    setAtivo(res.data);
    carregar();
    notify(
      `QR Code gerado. Vale para uma pessoa só e expira em ${rotuloPrazo(minutos)}.`,
      'success',
    );
  };

  const cancelar = async (convite: any) => {
    const res = await DatabaseService.revokeTeamInvite(convite.id);
    if (!res.success) return notify('Não foi possível cancelar.', 'error');
    if (ativo?.id === convite.id) setAtivo(null);
    carregar();
    notify('Convite cancelado.', 'info');
  };

  const expirado = (c: any) =>
    !!c.expires_at && new Date(c.expires_at).getTime() <= agora;

  const situacao = (c: any) =>
    c.used_at
      ? 'Utilizado'
      : c.revoked_at
        ? 'Cancelado'
        : expirado(c)
          ? 'Expirado'
          : 'Aguardando';

  /** Quanto falta, em mm:ss, para o convite morrer. */
  const restante = (c: any) => {
    if (!c.expires_at) return '';
    const ms = new Date(c.expires_at).getTime() - agora;
    if (ms <= 0) return '';
    const seg = Math.floor(ms / 1000);
    const m = Math.floor(seg / 60);
    const sgs = seg % 60;
    return `${m}:${String(sgs).padStart(2, '0')}`;
  };

  return (
    <div className={fundo}>
      <div className={`${caixa} max-w-2xl`}>
        <Cabecalho
          titulo="Cadastro por QR Code"
          subtitulo={`Um QR por pessoa · equipe de ${client.name}`}
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Para quem é este QR? (opcional)"
              className={input}
            />
            <select
              value={minutos}
              onChange={e => setMinutos(Number(e.target.value))}
              title="Depois desse tempo o QR Code deixa de valer"
              className={`${input} sm:w-44 cursor-pointer`}
            >
              {PRAZOS.map(op => (
                <option key={op.minutos} value={op.minutos}>
                  Expira em {op.label}
                </option>
              ))}
            </select>
            <button
              onClick={gerar}
              disabled={gerando}
              className="px-5 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-all"
            >
              {gerando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              <span>Gerar QR Code</span>
            </button>
          </div>

          {ativo && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center gap-3">
              {imagemQr ? (
                <img src={imagemQr} alt="QR Code do convite" className="w-56 h-56" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-300">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
              <p className="text-[11px] text-slate-500 font-bold text-center leading-snug">
                Mostre este QR para {ativo.note || 'a pessoa'}. Assim que o
                cadastro for concluído, ele deixa de funcionar.
                {restante(ativo) && (
                  <>
                    {' '}
                    Expira em{' '}
                    <span className="font-mono text-amber-700">
                      {restante(ativo)}
                    </span>
                    .
                  </>
                )}
                {expirado(ativo) && (
                  <span className="text-rose-600"> Este QR já expirou.</span>
                )}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(linkDe(ativo.token));
                  notify('Link do convite copiado.', 'success');
                }}
                className="text-[11px] font-black uppercase tracking-wider text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Copiar link
              </button>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest">
              Convites ({convites.length})
            </h4>
            {convites.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                Nenhum QR Code gerado ainda.
              </p>
            ) : (
              convites.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200"
                >
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      c.used_at
                        ? 'bg-emerald-50 text-emerald-700'
                        : c.revoked_at || expirado(c)
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {situacao(c)}
                  </span>
                  <span className="flex-1 text-xs font-bold text-slate-700 truncate">
                    {c.note || 'Sem identificação'}
                  </span>
                  {!c.used_at && !c.revoked_at && !expirado(c) && restante(c) && (
                    <span className="text-[10px] font-black font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">
                      {restante(c)}
                    </span>
                  )}
                  {!c.used_at && !c.revoked_at && !expirado(c) && (
                    <>
                      <button
                        onClick={() => setAtivo(c)}
                        className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700 cursor-pointer"
                      >
                        Ver QR
                      </button>
                      <button
                        onClick={() => cancelar(c)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        title="Cancelar convite"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 3. CADASTRO MANUAL PELO ADM                                                */
/* ========================================================================== */
export function CadastroManualModal({
  client,
  onClose,
  onChanged,
  notify,
  fields
}: BaseProps & { fields: any[] }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [foto, setFoto] = useState('');
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foto) return notify('A foto do integrante é obrigatória.', 'error');
    if (!nome.trim()) return notify('Informe o nome do integrante.', 'error');
    if (telefone.replace(/\D/g, '').length < 10)
      return notify('Informe o telefone com DDD.', 'error');

    const faltando = fields.filter(
      f => f.required && !((extras[f.label] || '').trim())
    );
    if (faltando.length > 0) {
      return notify(
        `Preencha: ${faltando.map(f => f.label).join(', ')}.`,
        'error'
      );
    }

    setSalvando(true);
    const res = await DatabaseService.upsertSupporter({
      id: '',
      full_name: nome.trim(),
      whatsapp: telefone,
      candidate_id: client.id,
      image: foto,
      extra_fields: extras,
      source: 'manual'
    });
    setSalvando(false);

    if (!res.success) {
      notify(`Não foi possível salvar: ${res.error || 'erro'}`, 'error');
      return;
    }
    notify(`${nome.trim()} cadastrado na equipe.`, 'success');
    onChanged();
    onClose();
  };

  return (
    <div className={fundo}>
      <form onSubmit={salvar} className={`${caixa} max-w-lg`}>
        <Cabecalho
          titulo="Cadastrar Integrante"
          subtitulo={`Equipe de ${client.name}`}
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
              Foto *
            </label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                {foto ? (
                  <img src={foto} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-5 h-5 text-slate-300" />
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setEnviandoFoto(true);
                  const res = await DatabaseService.uploadMedia(file);
                  setEnviandoFoto(false);
                  if (res.success && res.url) setFoto(res.url);
                  else notify(res.error || 'Falha ao enviar a foto.', 'error');
                }}
              />
              <button
                type="button"
                disabled={enviandoFoto}
                onClick={() => fileRef.current?.click()}
                className="px-4 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-2"
              >
                {enviandoFoto ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    {foto ? 'Trocar foto' : 'Escolher foto'}
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
              Nome completo *
            </label>
            <input value={nome} onChange={e => setNome(e.target.value)} className={input} />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
              Telefone (WhatsApp) *
            </label>
            <input
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              placeholder="DDD + número"
              className={input}
            />
          </div>

          {fields.map(f => (
            <div key={f.id}>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                {f.label} {f.required ? '*' : ''}
              </label>
              {f.type === 'select' ? (
                <select
                  value={extras[f.label] || ''}
                  onChange={e => setExtras(p => ({ ...p, [f.label]: e.target.value }))}
                  className={`${input} cursor-pointer`}
                >
                  <option value="">Selecione...</option>
                  {(f.options || []).map((op: string) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                  value={extras[f.label] || ''}
                  onChange={e => setExtras(p => ({ ...p, [f.label]: e.target.value }))}
                  className={input}
                />
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 h-10 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="px-5 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-2"
          >
            {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar integrante
          </button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================== */
/* 4. CAMPOS DE COLETA DO CLIENTE                                             */
/* ========================================================================== */
/**
 * O ADM decide o que mais perguntar, cliente por cliente.
 *
 * Foto, nome e telefone são pedidos sempre; o que estiver aqui entra nos dois
 * caminhos de cadastro novo — o manual e o do QR Code.
 */
export function CamposColetaModal({
  client,
  onClose,
  onChanged,
  notify,
  fields
}: BaseProps & { fields: any[] }) {
  const [lista, setLista] = useState<any[]>(fields);
  const [label, setLabel] = useState('');
  const [tipo, setTipo] = useState('text');
  const [opcoes, setOpcoes] = useState('');
  const [obrigatorio, setObrigatorio] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const recarregar = async () => {
    const res = await DatabaseService.fetchTeamFields(client.id);
    if (res.success) setLista(res.data);
    onChanged();
  };

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return notify('Dê um nome ao campo.', 'error');
    if (lista.some(f => f.label.toLowerCase() === label.trim().toLowerCase())) {
      return notify('Este cliente já tem um campo com esse nome.', 'error');
    }

    setSalvando(true);
    const res = await DatabaseService.upsertTeamField({
      candidate_id: client.id,
      label: label.trim(),
      type: tipo,
      options:
        tipo === 'select'
          ? opcoes.split(',').map(o => o.trim()).filter(Boolean)
          : null,
      required: obrigatorio,
      position: lista.length + 1
    });
    setSalvando(false);

    if (!res.success) return notify(`Não foi possível salvar: ${res.error}`, 'error');
    setLabel('');
    setOpcoes('');
    setObrigatorio(false);
    setTipo('text');
    recarregar();
    notify('Campo adicionado.', 'success');
  };

  const remover = async (campo: any) => {
    const res = await DatabaseService.deleteTeamField(campo.id);
    if (!res.success) return notify('Não foi possível remover.', 'error');
    recarregar();
    notify('Campo removido.', 'info');
  };

  return (
    <div className={fundo}>
      <div className={`${caixa} max-w-lg`}>
        <Cabecalho
          titulo="Campos de Coleta"
          subtitulo={`O que perguntar no cadastro · ${client.name}`}
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <p className="text-[11px] text-slate-500 font-semibold bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">
            Foto, nome e telefone são pedidos sempre. Os campos abaixo entram no
            cadastro manual e no cadastro por QR Code deste cliente.
          </p>

          <form onSubmit={adicionar} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1">
                  Nome do campo
                </label>
                <input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Ex: Bairro de atuação"
                  className={input}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1">
                  Tipo
                </label>
                <select
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  className={`${input} cursor-pointer`}
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                  <option value="email">E-mail</option>
                  <option value="select">Lista de opções</option>
                </select>
              </div>
            </div>

            {tipo === 'select' && (
              <div>
                <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1">
                  Opções (separadas por vírgula)
                </label>
                <input
                  value={opcoes}
                  onChange={e => setOpcoes(e.target.value)}
                  placeholder="Ex: Norte, Sul, Centro"
                  className={input}
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={obrigatorio}
                  onChange={e => setObrigatorio(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-600">
                  Preenchimento obrigatório
                </span>
              </label>
              <button
                type="submit"
                disabled={salvando}
                className="px-4 h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                Adicionar campo
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <h4 className="font-extrabold text-[11px] text-indigo-950 uppercase tracking-widest">
              Cadastrados ({lista.length})
            </h4>
            {lista.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                Nenhum campo extra. O cadastro pede só foto, nome e telefone.
              </p>
            ) : (
              lista.map(f => (
                <div
                  key={f.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200"
                >
                  <span className="flex-1 text-xs font-bold text-slate-700 truncate">
                    {f.label}
                    {f.required && <span className="text-rose-500"> *</span>}
                  </span>
                  <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                    {f.type}
                  </span>
                  <button
                    onClick={() => remover(f)}
                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                    title="Remover campo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
