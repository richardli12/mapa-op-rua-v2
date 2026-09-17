import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, ShieldAlert, UserPlus } from 'lucide-react';
import { DatabaseService } from '../databaseClient';

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
  nao_encontrado: 'Este convite não existe.',
  ja_utilizado: 'Este QR Code já foi usado por outra pessoa.',
  cancelado: 'Este convite foi cancelado.',
  expirado: 'Este convite expirou.',
  convite_invalido: 'Este QR Code não é mais válido.',
  nome_obrigatorio: 'Informe o nome completo.',
  telefone_invalido: 'Informe um telefone válido com DDD.',
  foto_obrigatoria: 'A foto é obrigatória.'
};

/**
 * Cadastro pelo QR Code.
 *
 * Página pública: quem chega aqui leu um QR gerado para uma pessoa só. O
 * convite carrega o cliente e a lista de campos que aquele cliente pede, então
 * esta tela não decide nada sozinha — ela mostra o que o convite mandar.
 */
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const res = await DatabaseService.getTeamInvite(token);
      if (!res.success) {
        setErro('Não foi possível validar este convite.');
      } else if (!res.data?.valid) {
        setErro(MOTIVOS[res.data?.reason] || 'Este QR Code não é mais válido.');
      } else {
        setConvite(res.data);
      }
      setCarregando(false);
    })();
  }, [token]);

  const campos: CampoColeta[] = convite?.fields || [];

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
      c => c.required && !((extras[c.label] || '').trim())
    );
    if (faltando.length > 0) {
      return setErro(`Preencha: ${faltando.map(c => c.label).join(', ')}.`);
    }

    setSalvando(true);
    setErro(null);
    const res = await DatabaseService.claimTeamInvite({
      token,
      name: nome.trim(),
      whatsapp: telefone,
      image: foto,
      extra: extras
    });
    setSalvando(false);

    if (!res.success) return setErro(res.error || 'Falha ao concluir o cadastro.');
    if (!res.data?.ok) {
      return setErro(MOTIVOS[res.data?.reason] || 'Este QR Code não é mais válido.');
    }
    setConcluido(true);
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center font-sans">
        <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin" />
          Validando convite...
        </div>
      </div>
    );
  }

  if (concluido) {
    return (
      <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center p-5 font-sans">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 max-w-sm w-full text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Check className="w-7 h-7 stroke-[3]" />
          </div>
          <h1 className="text-lg font-black text-[#0D233A]">Cadastro concluído!</h1>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Você agora faz parte da equipe
            {convite?.candidateName ? ` de ${convite.candidateName}` : ''}. Este
            QR Code foi encerrado e não serve para mais ninguém.
          </p>
        </div>
      </div>
    );
  }

  if (!convite) {
    return (
      <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center p-5 font-sans">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 max-w-sm w-full text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-[#0D233A]">Convite indisponível</h1>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            {erro || 'Este QR Code não é mais válido.'}
          </p>
          <p className="text-[11px] text-slate-400 font-semibold">
            Peça um novo QR Code a quem coordena a equipe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF2F7] p-5 font-sans flex justify-center">
      <form
        onSubmit={enviar}
        className="bg-white border border-slate-200 rounded-3xl shadow-sm w-full max-w-md h-fit overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
          {convite.candidateImage ? (
            <img
              src={convite.candidateImage}
              alt={convite.candidateName}
              className="w-11 h-11 rounded-2xl object-cover border border-slate-100"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-black text-[#0D233A] leading-tight">
              Cadastro na Equipe
            </h1>
            <p className="text-[11px] text-slate-400 font-bold truncate">
              {convite.candidateName}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* FOTO */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
              Foto *
            </label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                {foto ? (
                  <img src={foto} alt="Sua foto" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-5 h-5 text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) enviarFoto(file);
                  }}
                />
                <button
                  type="button"
                  disabled={enviandoFoto}
                  onClick={() => fileRef.current?.click()}
                  className="px-4 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
                >
                  {enviandoFoto ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      {foto ? 'Trocar foto' : 'Tirar foto'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
              Nome completo *
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Como você é chamado"
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
              Telefone (WhatsApp) *
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              placeholder="DDD + número"
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* CAMPOS QUE O ADM CONFIGUROU PARA ESTE CLIENTE */}
          {campos.map(campo => (
            <div key={campo.id}>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                {campo.label} {campo.required ? '*' : ''}
              </label>
              {campo.type === 'select' ? (
                <select
                  value={extras[campo.label] || ''}
                  onChange={e =>
                    setExtras(p => ({ ...p, [campo.label]: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">Selecione...</option>
                  {(campo.options || []).map(op => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={campo.type === 'number' ? 'number' : campo.type === 'date' ? 'date' : campo.type === 'email' ? 'email' : 'text'}
                  value={extras[campo.label] || ''}
                  onChange={e =>
                    setExtras(p => ({ ...p, [campo.label]: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>
          ))}

          {erro && (
            <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={salvando || enviandoFoto}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Concluir cadastro'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
