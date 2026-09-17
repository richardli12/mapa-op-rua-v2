import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  Loader2,
  Phone,
  Plus,
  ShieldAlert,
  User,
} from 'lucide-react';
import { DatabaseService, db } from '../databaseClient';
import { lerDispositivo } from '../services/dispositivo';
import BrandMark from './BrandMark';

/** Cores da marca, as mesmas do resto do sistema. */
const AZUL = '#0C3556';
const LARANJA = '#F58220';

const classeEntrada =
  'w-full py-3 bg-transparent border-none text-[14px] font-semibold text-[#0C3556] placeholder-[#B9C6D2] focus:outline-hidden';

/** (00) 00000-0000 — o mesmo formato do login do integrante. */
const mascararTelefone = (valor: string) => {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

interface TeamSignupPageProps {
  token: string;
}

interface CampoColeta {
  id: string;
  label: string;
  type: string;
  options?: string[] | null;
  required?: boolean;
}

const MOTIVOS: Record<string, string> = {
  nao_encontrado: 'Este link não existe mais.',
  ja_utilizado: 'Este QR Code já foi usado por outra pessoa.',
  cancelado: 'Este convite foi cancelado.',
  expirado: 'Este link expirou e não existe mais.',
  convite_invalido: 'Este QR Code não é mais válido.',
  nome_obrigatorio: 'Informe o nome completo.',
  telefone_invalido: 'Informe um telefone válido com DDD.',
  foto_obrigatoria: 'A foto é obrigatória.',
};

/**
 * Cadastro pelo QR Code.
 *
 * Página pública: quem chega aqui leu um QR gerado para uma pessoa só. O
 * convite carrega o cliente e a lista de campos que aquele cliente pede, então
 * esta tela não decide nada sozinha — ela mostra o que o convite mandar.
 */
/** Moldura comum das telas: fundo claro, marca no topo e o cartão branco. */
function Moldura({
  titulo,
  children,
  relogio,
  restante,
}: {
  titulo: string;
  children: React.ReactNode;
  relogio: string;
  restante: number | null;
}) {
  return (
    <div className="min-h-[100dvh] w-full font-sans flex flex-col bg-linear-to-b from-[#E8EEF4] to-[#D6DFE8]">
      <div className="px-6 pt-7 pb-5 select-none">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0">
            <BrandMark size={40} rounded={13} variant="clara" />
          </span>
          <span
            className="text-[16px] font-extrabold tracking-tight"
            style={{ color: AZUL }}
          >
            Mapa Operacional
          </span>
          {relogio && (
            <span
              title="Tempo restante deste convite"
              className={`ml-auto text-[11px] font-black font-mono px-2 py-1 rounded-lg shrink-0 ${
                restante !== null && restante <= 30
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-white/70 text-[#5A6E85]'
              }`}
            >
              {relogio}
            </span>
          )}
        </div>

        <h1
          className="mt-5 font-extrabold tracking-tight leading-tight"
          style={{ color: AZUL, fontSize: 'clamp(20px, 6.2vw, 28px)' }}
        >
          {titulo}
        </h1>
      </div>

      <div className="flex-1 min-h-0 px-4 pb-6">
        <div className="max-w-[440px] mx-auto w-full bg-white rounded-3xl shadow-[0_8px_30px_rgba(12,53,86,.10)] p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Campo de texto no estilo do login: rótulo em cima, ícone dentro. */
function Campo({
  rotulo,
  icone,
  children,
}: {
  rotulo: string;
  icone?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#5A6E85]">
        {rotulo}
      </label>
      <div className="mt-2 rounded-xl bg-[#F4F7FA] border border-[#E4EBF1] flex items-center px-3.5 overflow-hidden transition-all focus-within:border-[#F58220] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#F58220]/12">
        {icone && <span className="shrink-0 mr-2.5">{icone}</span>}
        {children}
      </div>
    </div>
  );
}

export default function TeamSignupPage({ token }: TeamSignupPageProps) {
  const [carregando, setCarregando] = useState(true);
  const [convite, setConvite] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [foto, setFoto] = useState<string>('');
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  /** Quanto falta para o convite expirar, em segundos. */
  const [restante, setRestante] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Aparelho que abriu este convite. Só ele conclui o cadastro. */
  const aparelhoRef = useRef('');

  useEffect(() => {
    (async () => {
      // O aparelho é identificado antes de pedir o convite: é ele que prende o
      // QR Code a uma leitura só.
      let aparelho = '';
      try {
        aparelho = (await lerDispositivo()).deviceIdHash;
        aparelhoRef.current = aparelho;
      } catch {
        /* sem identificação, o banco recusa a abertura */
      }
      const res = await DatabaseService.abrirConviteEquipe(token, aparelho);
      if (!res.success) {
        setErro('Não foi possível validar este convite.');
      } else if (!res.data?.valid) {
        setErro(MOTIVOS[res.data?.reason] || 'Este QR Code não é mais válido.');
      } else {
        setConvite(res.data);
        if (res.data.expiresAt) {
          // O relógio do aparelho pode estar adiantado ou atrasado, então a
          // conta é feita sobre a diferença medida no servidor.
          const fim = new Date(res.data.expiresAt).getTime();
          const agoraServidor = res.data.serverNow
            ? new Date(res.data.serverNow).getTime()
            : Date.now();
          setRestante(Math.max(0, Math.round((fim - agoraServidor) / 1000)));
        }
      }
      setCarregando(false);
    })();
  }, [token]);

  // Contagem regressiva: ao zerar, a tela se encerra sozinha, mesmo que a
  // pessoa esteja com ela aberta desde antes.
  useEffect(() => {
    if (restante === null || concluido) return;
    if (restante <= 0) {
      setConvite(null);
      setErro(MOTIVOS.expirado);
      return;
    }
    const t = setTimeout(
      () => setRestante((r) => (r === null ? r : r - 1)),
      1000,
    );
    return () => clearTimeout(t);
  }, [restante, concluido]);

  // Cancelamento ou uso feito em outro lugar derruba esta tela na hora.
  useEffect(() => {
    if (!db || !convite || concluido) return;
    const canal = db
      .channel(`convite-${token}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'team_invites',
          filter: `token=eq.${token}`,
        },
        (payload: any) => {
          const linha = payload?.new || {};
          if (linha.used_at || linha.revoked_at) {
            setConvite(null);
            setErro(linha.used_at ? MOTIVOS.ja_utilizado : MOTIVOS.cancelado);
          }
        },
      )
      .subscribe();
    return () => {
      db.removeChannel(canal);
    };
  }, [token, convite, concluido]);

  const campos: CampoColeta[] = convite?.fields || [];

  const relogio =
    restante !== null && restante > 0
      ? `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}`
      : '';

  const enviarFoto = async (file: File) => {
    setEnviandoFoto(true);
    const res = await DatabaseService.uploadMedia(file);
    setEnviandoFoto(false);
    if (res.success && res.url) {
      setFoto(res.url);
      setErro(null);
    } else {
      setErro(res.error || 'Não foi possível enviar a foto.');
    }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foto) return setErro('Tire ou escolha uma foto para continuar.');
    if (!nome.trim()) return setErro('Informe o nome completo.');
    if (telefone.replace(/\D/g, '').length < 10)
      return setErro('Informe o telefone com DDD.');

    const faltando = campos.filter(
      (c) => c.required && !(extras[c.label] || '').trim(),
    );
    if (faltando.length > 0) {
      return setErro(`Preencha: ${faltando.map((c) => c.label).join(', ')}.`);
    }

    setSalvando(true);
    setErro(null);
    const res = await DatabaseService.claimTeamInvite({
      token,
      name: nome.trim(),
      whatsapp: telefone,
      image: foto,
      extra: extras,
      deviceIdHash: aparelhoRef.current,
    });
    setSalvando(false);

    if (!res.success)
      return setErro(res.error || 'Falha ao concluir o cadastro.');
    if (!res.data?.ok) {
      return setErro(
        MOTIVOS[res.data?.reason] || 'Este QR Code não é mais válido.',
      );
    }
    // Aparelho do cadastro: fica guardado para o administrador e passa a ser o
    // único que abre o painel desta pessoa. Falha aqui não desfaz o cadastro,
    // que já está feito — o vínculo então nasce no primeiro acesso ao painel.
    try {
      const ficha = await lerDispositivo();
      await DatabaseService.registrarDispositivoMembro({
        memberId: res.data.id,
        candidateId: convite?.candidateId || null,
        whatsapp: telefone.replace(/\D/g, ''),
        origem: 'cadastro',
        ficha,
      });
    } catch (err) {
      console.warn('Não foi possível registrar o aparelho do cadastro:', err);
    }

    setConcluido(true);
  };

  if (carregando) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center font-sans bg-linear-to-b from-[#E8EEF4] to-[#D6DFE8]">
        <div className="flex items-center gap-2 text-[#7A8A9B] font-bold text-xs uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin" />
          Validando convite...
        </div>
      </div>
    );
  }

  if (concluido) {
    return (
      <Moldura
        titulo="Cadastro concluído"
        relogio={relogio}
        restante={restante}
      >
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Check className="w-7 h-7 stroke-[3]" />
          </div>
          <p className="text-[13px] text-[#5A6E85] font-semibold leading-relaxed">
            Você agora faz parte da equipe
            {convite?.candidateName ? ` de ${convite.candidateName}` : ''}. Este
            QR Code foi encerrado e não serve para mais ninguém.
          </p>
        </div>
      </Moldura>
    );
  }

  if (!convite) {
    return (
      <Moldura
        titulo="Convite indisponível"
        relogio={relogio}
        restante={restante}
      >
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <p className="text-[13px] text-[#5A6E85] font-semibold leading-relaxed">
            {erro || 'Este QR Code não é mais válido.'}
          </p>
          <p className="text-[12px] text-[#9AA9B8] font-semibold">
            Peça um novo QR Code a quem coordena a equipe.
          </p>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura
      titulo="Complete seu cadastro"
      relogio={relogio}
      restante={restante}
    >
      <form onSubmit={enviar}>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#9AA9B8]">
          Seus dados
        </p>
        <span className="block w-9 h-[3px] rounded-full bg-[#E3E9EF] mt-2.5" />

        {/* FOTO */}
        <div className="mt-5 flex flex-col items-center">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) enviarFoto(file);
            }}
          />
          <button
            type="button"
            disabled={enviandoFoto}
            onClick={() => fileRef.current?.click()}
            className="relative w-[84px] h-[84px] cursor-pointer active:scale-95 transition-transform disabled:opacity-60"
            aria-label={foto ? 'Trocar foto' : 'Adicionar foto'}
          >
            {/* O corte fica só na foto: assim o + laranja passa da borda. */}
            <span className="w-full h-full rounded-full bg-[#DCE5EE] overflow-hidden flex items-center justify-center">
              {foto ? (
                <img
                  src={foto}
                  alt="Sua foto"
                  className="w-full h-full object-cover"
                />
              ) : enviandoFoto ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#7A8A9B]" />
              ) : (
                <Camera className="w-7 h-7 text-[#7A8A9B]" />
              )}
            </span>
            <span
              className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full text-white flex items-center justify-center shadow-md ring-2 ring-white"
              style={{ backgroundColor: LARANJA }}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </span>
          </button>
          <p
            className="mt-2 text-[12.5px] font-extrabold"
            style={{ color: AZUL }}
          >
            {foto ? 'Trocar foto' : 'Adicionar foto'}
          </p>
          <p className="text-[11px] font-semibold text-[#9AA9B8]">
            Obrigatória
          </p>
        </div>

        <Campo
          rotulo="Nome completo"
          icone={<User className="w-4.5 h-4.5 text-[#A5B4C2]" />}
        >
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Digite seu nome"
            className={classeEntrada}
          />
        </Campo>

        <Campo
          rotulo="Telefone (WhatsApp)"
          icone={<Phone className="w-4.5 h-4.5" style={{ color: LARANJA }} />}
        >
          <input
            type="tel"
            inputMode="numeric"
            value={telefone}
            onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
            placeholder="(00) 00000-0000"
            className={classeEntrada}
          />
        </Campo>

        {/* CAMPOS QUE O ADM CONFIGUROU PARA ESTE CLIENTE */}
        {campos.map((campo) => (
          <React.Fragment key={campo.id}>
            <Campo rotulo={`${campo.label}${campo.required ? ' *' : ''}`}>
              {campo.type === 'select' ? (
                <select
                  value={extras[campo.label] || ''}
                  onChange={(e) =>
                    setExtras((p) => ({
                      ...p,
                      [campo.label]: e.target.value,
                    }))
                  }
                  className={`${classeEntrada} cursor-pointer`}
                >
                  <option value="">Selecione...</option>
                  {(campo.options || []).map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={
                    campo.type === 'number'
                      ? 'number'
                      : campo.type === 'date'
                        ? 'date'
                        : campo.type === 'email'
                          ? 'email'
                          : 'text'
                  }
                  value={extras[campo.label] || ''}
                  onChange={(e) =>
                    setExtras((p) => ({
                      ...p,
                      [campo.label]: e.target.value,
                    }))
                  }
                  className={classeEntrada}
                />
              )}
            </Campo>
          </React.Fragment>
        ))}

        {erro && (
          <p className="mt-4 text-[11.5px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={salvando || enviandoFoto}
          className="mt-5 w-full py-4 text-white font-extrabold text-[12.5px] uppercase tracking-wider rounded-xl transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          style={{ backgroundColor: AZUL }}
        >
          {salvando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              Concluir cadastro
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </Moldura>
  );
}
