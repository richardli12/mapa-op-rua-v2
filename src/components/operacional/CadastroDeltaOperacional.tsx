import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Camera, Check, Loader2, Phone, Radar, User, X } from 'lucide-react';
import BrandMark from '../BrandMark';
import CarregandoOperacional from '../CarregandoOperacional';
import { DatabaseService } from '../../databaseClient';
import {
  DeltaOperacionalService,
  linkDoPainelOperacional,
  mascararTelefone,
  soDigitos
} from '../../services/deltaOperacional';

const MOTIVOS: Record<string, string> = {
  nao_encontrado: 'Este QR Code não existe.',
  ja_utilizado: 'Este QR Code já foi usado. Cada um vale para uma pessoa só.',
  cancelado: 'Este QR Code foi cancelado pela coordenação.',
  expirado: 'Este QR Code expirou. Peça um novo à coordenação.',
  convite_invalido: 'Este QR Code não vale mais. Peça um novo à coordenação.',
  nome_obrigatorio: 'Escreva o seu nome.',
  telefone_invalido: 'Confira o número do WhatsApp, com DDD.'
};

/**
 * O cadastro do Delta Operacional pelo QR Code.
 *
 * Três campos — nome, WhatsApp e, se quiser, uma foto — e a pessoa sai
 * daqui direto para o painel dela: o QR que cadastra é o mesmo gesto que dá
 * acesso, sem esperar um link chegar depois.
 */
export default function CadastroDeltaOperacional({ token }: { token: string }) {
  const [fase, setFase] = useState<'abrindo' | 'form' | 'invalido' | 'pronto'>('abrindo');
  const [cliente, setCliente] = useState<{ name: string; image: string }>({ name: '', image: '' });
  const [motivo, setMotivo] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [foto, setFoto] = useState<{ arquivo: File; previa: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [linkDoPainel, setLinkDoPainel] = useState('');
  const [atualizado, setAtualizado] = useState(false);
  const entradaDeFoto = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.title = 'Cadastro — Delta Operacional';
    (async () => {
      const res = await DeltaOperacionalService.abrirConvite(token);
      if (!res.success) {
        setMotivo(res.error || 'Não foi possível abrir o convite.');
        setFase('invalido');
        return;
      }
      if (!res.data?.valid) {
        setMotivo(MOTIVOS[res.data?.reason] || 'Este QR Code não vale mais.');
        setFase('invalido');
        return;
      }
      setCliente({ name: res.data.candidateName, image: res.data.candidateImage });
      setFase('form');
    })();
  }, [token]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErro(MOTIVOS.nome_obrigatorio);
    if (soDigitos(telefone).length < 10) return setErro(MOTIVOS.telefone_invalido);
    setEnviando(true);
    setErro('');
    let imagem = '';
    if (foto) {
      const envio = await DatabaseService.uploadMedia(foto.arquivo);
      // A foto é opcional: se não subir, o cadastro segue sem ela.
      if (envio.success && envio.url) imagem = envio.url;
    }
    const res = await DeltaOperacionalService.concluirCadastro({
      token,
      nome: nome.trim(),
      whatsapp: telefone,
      image: imagem
    });
    setEnviando(false);
    if (!res.success) return setErro(res.error || 'Não foi possível concluir.');
    if (!res.data?.ok) {
      const razao = res.data?.reason || '';
      if (razao === 'convite_invalido') {
        setMotivo(MOTIVOS.convite_invalido);
        setFase('invalido');
        return;
      }
      return setErro(MOTIVOS[razao] || 'Não foi possível concluir.');
    }
    setAtualizado(!!res.data.updated);
    setLinkDoPainel(linkDoPainelOperacional(res.data.token));
    setFase('pronto');
    // O QR já foi usado: recarregar este endereço não deve trazer de volta um
    // cadastro que vai dizer "convite inválido".
    const chave = `rota_cadastro_operacional:${window.location.hostname.toLowerCase()}`;
    for (const cofre of [sessionStorage, localStorage]) {
      try {
        cofre.removeItem(chave);
      } catch {
        /* sem armazenamento: nada a limpar */
      }
    }
  };

  /**
   * Vai para o painel.
   *
   * Com o cadastro e o painel no mesmo domínio, o link difere só no que vem
   * depois do `#` — e o navegador não recarrega a página por isso. A rota é
   * lida uma vez, na carga; sem recarregar, a pessoa ficaria nesta tela.
   */
  const irParaOPainel = (e: React.MouseEvent) => {
    e.preventDefault();
    const destino = new URL(linkDoPainel);
    if (destino.origin === window.location.origin) {
      window.history.replaceState(null, '', `${destino.pathname}${destino.hash}`);
      window.location.reload();
    } else {
      window.location.href = linkDoPainel;
    }
  };

  if (fase === 'abrindo') {
    return <CarregandoOperacional etapas={['Abrindo o convite', 'Conferindo o QR Code']} />;
  }

  return (
    <div className="op-carregando min-h-[100dvh] w-full flex items-center justify-center px-5 py-10 font-sans text-white">
      <div className="op-grade" aria-hidden="true" />
      <div className="relative w-full max-w-[420px] lg-cartao">
        <div className="flex flex-col items-center text-center">
          {cliente.image ? (
            <img src={cliente.image} alt="" referrerPolicy="no-referrer" className="w-20 h-20 rounded-full object-cover border-2 border-white/15 shadow-2xl" />
          ) : (
            <BrandMark size={64} rounded={18} />
          )}
          <p className="mt-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#FDBA74]">
            <Radar className="w-3.5 h-3.5" />
            Delta Operacional
          </p>
          <h1 className="mt-2 text-[24px] font-black tracking-tight leading-tight">
            {fase === 'pronto'
              ? atualizado
                ? 'Cadastro atualizado'
                : 'Cadastro concluído'
              : cliente.name
                ? `Você foi convidado por ${cliente.name}`
                : 'Convite'}
          </h1>
          {fase === 'form' && (
            <p className="mt-2 text-[13px] text-slate-400 leading-relaxed max-w-[330px]">
              Como Delta Operacional você vai planejar as operações no mapa:
              desenhar o raio, escolher os pontos e montar o plano de ação.
            </p>
          )}
        </div>

        {fase === 'invalido' && (
          <div className="mt-8 rounded-2xl bg-rose-500/10 border border-rose-400/25 p-5 text-center">
            <AlertTriangle className="w-6 h-6 text-rose-300 mx-auto" />
            <p className="mt-3 text-[14px] font-bold text-rose-50 leading-snug">{motivo}</p>
          </div>
        )}

        {fase === 'pronto' && (
          <div className="mt-8 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-300 stroke-[3]" />
            </div>
            <p className="text-[13px] text-slate-300 leading-relaxed">
              Guarde este link: é a sua entrada no painel. Na primeira vez ele
              pede o seu WhatsApp para confirmar que é você.
            </p>
            <a href={linkDoPainel} onClick={irParaOPainel} className="op-botao-principal no-underline">
              Entrar no meu painel
              <ArrowRight className="w-4 h-4 stroke-[2.75]" />
            </a>
          </div>
        )}

        {fase === 'form' && (
          <form onSubmit={enviar} className="mt-8 space-y-4" noValidate>
            {/* Foto, opcional */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => entradaDeFoto.current?.click()}
                className="relative w-20 h-20 rounded-full bg-white/[0.04] border-2 border-dashed border-white/15 hover:border-[#F58220]/60 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Escolher foto"
              >
                {foto ? (
                  <img src={foto.previa} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-slate-500" />
                )}
              </button>
              <div className="min-w-0">
                <p className="text-[13px] font-bold">Foto <span className="text-slate-500 font-semibold">(opcional)</span></p>
                <p className="text-[11.5px] text-slate-500 leading-snug">Ajuda a equipe a saber quem planejou cada operação.</p>
                {foto && (
                  <button
                    type="button"
                    onClick={() => setFoto(null)}
                    className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Tirar foto
                  </button>
                )}
              </div>
              <input
                ref={entradaDeFoto}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  e.target.value = '';
                  if (!arquivo) return;
                  if (arquivo.size > 8 * 1024 * 1024) return setErro('A foto pode ter até 8 MB.');
                  setFoto({ arquivo, previa: URL.createObjectURL(arquivo) });
                }}
              />
            </div>

            <div>
              <label htmlFor="opc-nome" className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">
                Nome completo
              </label>
              <div className="lg-campo">
                <User className="w-[18px] h-[18px] shrink-0 text-slate-500 lg-campo-icone" />
                <input
                  id="opc-nome"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    setErro('');
                  }}
                  autoComplete="name"
                  placeholder="Seu nome"
                  className="flex-1 min-w-0 h-full bg-transparent border-none text-[16px] font-semibold text-white placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="opc-tel" className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">
                WhatsApp
              </label>
              <div className="lg-campo">
                <Phone className="w-[18px] h-[18px] shrink-0 text-slate-500 lg-campo-icone" />
                <input
                  id="opc-tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={telefone}
                  onChange={(e) => {
                    setTelefone(mascararTelefone(e.target.value));
                    setErro('');
                  }}
                  placeholder="(82) 99999-9999"
                  className="flex-1 min-w-0 h-full bg-transparent border-none text-[16px] font-semibold text-white placeholder:text-slate-600 focus:outline-none tabular-nums"
                />
              </div>
            </div>

            {erro && (
              <div role="alert" className="lg-erro flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-rose-500/10 border border-rose-400/25">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-rose-300" />
                <p className="text-[12.5px] font-semibold text-rose-100 leading-snug">{erro}</p>
              </div>
            )}

            <button type="submit" disabled={enviando} className="op-botao-principal">
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cadastrando
                </>
              ) : (
                <>
                  Concluir cadastro
                  <ArrowRight className="w-4 h-4 stroke-[2.75]" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
