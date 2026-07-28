import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NIVEL_DESCRICAO, NIVEL_HEX, NIVEL_LABEL } from '../nivel';

/**
 * Página de Metodologia & Fontes. Documenta proveniência dos dados,
 * definições de indicadores, metodologia de níveis e limitações —
 * dimensão de transparência/qualidade de dados da vigilância.
 */
@Component({
  selector: 'app-metodologia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="doc">
      <header>
        <h1>Metodologia &amp; Fontes</h1>
        <p class="lead">
          Como o Radar de Arboviroses coleta, calcula e apresenta os dados de dengue e
          chikungunya. Transparência metodológica é parte do compromisso de uma
          plataforma de vigilância confiável.
        </p>
      </header>

      <section>
        <h2>Fontes de dados</h2>
        <dl class="fontes">
          <div>
            <dt>InfoDengue (Fiocruz / FGV)</dt>
            <dd>
              Casos notificados e estimados, número reprodutivo (Rt), incidência e nível de
              alerta por município e semana epidemiológica.
              <a href="https://info.dengue.mat.br" target="_blank" rel="noopener">info.dengue.mat.br</a>
            </dd>
          </div>
          <div>
            <dt>IBGE</dt>
            <dd>
              Malha territorial dos municípios (geometrias), população e divisão regional.
              <a href="https://servicodados.ibge.gov.br" target="_blank" rel="noopener">servicodados.ibge.gov.br</a>
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2>Indicadores</h2>
        <dl class="indicadores">
          <div>
            <dt>Casos estimados</dt>
            <dd>Estimativa do InfoDengue que corrige o atraso de notificação (nowcasting),
              aproximando o número real de casos da semana antes de a notificação se consolidar.</dd>
          </div>
          <div>
            <dt>Incidência por 100 mil habitantes</dt>
            <dd>Casos por 100&nbsp;mil habitantes — permite comparar municípios de portes
              diferentes em pé de igualdade. Métrica padrão de vigilância.</dd>
          </div>
          <div>
            <dt>Rt — número reprodutivo efetivo</dt>
            <dd>Número médio de pessoas infectadas por cada caso. <strong>Rt&nbsp;&gt;&nbsp;1</strong>
              indica transmissão em crescimento; <strong>Rt&nbsp;&lt;&nbsp;1</strong>, em queda.</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2>Níveis de alerta</h2>
        <p class="sub">Classificação do InfoDengue, combinando incidência, transmissão (Rt) e
          condições climáticas favoráveis ao mosquito.</p>
        <ul class="niveis">
          @for (n of niveis; track n) {
            <li>
              <span class="chip" [style.color]="hex[n]" [style.background]="hex[n] + '1a'">{{ label[n] }}</span>
              <span class="desc">{{ descricao[n] }}</span>
            </li>
          }
        </ul>
      </section>

      <section>
        <h2>Atualização e janela temporal</h2>
        <p>Os dados são atualizados semanalmente a partir do InfoDengue por um pipeline
          orquestrado em n8n. A janela histórica é reprocessada para incorporar correções
          retroativas de notificação. O selo "Atualizado em…" no painel indica a data da
          última carga bem-sucedida.</p>
      </section>

      <section>
        <h2>Limitações</h2>
        <ul class="limites">
          <li>Casos estimados são uma <strong>projeção estatística</strong>, sujeita a
            revisão à medida que novas notificações chegam.</li>
          <li>Municípios sem dados na semana aparecem como "sem dados" — ausência de dado
            não equivale a ausência de casos.</li>
          <li>Os dados refletem <strong>casos notificados</strong> ao sistema de saúde;
            a subnotificação varia entre municípios.</li>
        </ul>
      </section>
    </article>
  `,
  styles: [`
    .doc { max-width: 780px; margin: 0 auto; padding: 24px 20px 48px; color: var(--text); }
    header { margin-bottom: 28px; }
    h1 { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 10px; }
    .lead { color: var(--muted); font-size: 0.95rem; line-height: 1.65; max-width: 640px; }
    section { margin-bottom: 30px; }
    h2 { font-size: 1.05rem; font-weight: 700; margin-bottom: 12px;
      padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .sub { color: var(--muted); font-size: 0.88rem; margin-bottom: 14px; line-height: 1.6; }
    dl { display: flex; flex-direction: column; gap: 16px; margin: 0; }
    dt { font-weight: 700; font-size: 0.92rem; margin-bottom: 4px; }
    dd { margin: 0; color: var(--muted); font-size: 0.88rem; line-height: 1.6; }
    dd a { display: inline-block; margin-top: 2px; }
    .niveis { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
    .niveis li { display: flex; align-items: flex-start; gap: 12px; }
    .chip { flex-shrink: 0; min-width: 84px; text-align: center; font-size: 0.74rem; font-weight: 700;
      padding: 4px 10px; border-radius: 999px; }
    .desc { color: var(--muted); font-size: 0.88rem; line-height: 1.55; padding-top: 2px; }
    .limites, ul.niveis { padding: 0; }
    .limites { margin: 0; padding-left: 20px; color: var(--muted); font-size: 0.88rem; line-height: 1.7; }
    p { color: var(--muted); font-size: 0.9rem; line-height: 1.65; margin: 0; }

    @media (max-width: 700px) {
      .doc { padding: 18px 14px 40px; }
      h1 { font-size: 1.3rem; }
      .lead { font-size: 0.88rem; }
      section { margin-bottom: 24px; }
      /* Chip acima da descrição — lado a lado sobra pouco texto */
      .niveis li { flex-direction: column; align-items: flex-start; gap: 5px; }
      .chip { min-width: 0; }
    }
  `],
})
export class Metodologia {
  protected readonly niveis = [1, 2, 3, 4];
  protected readonly hex = NIVEL_HEX;
  protected readonly label = NIVEL_LABEL;
  protected readonly descricao = NIVEL_DESCRICAO;
}
