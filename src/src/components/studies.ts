// The published sources cited by the calculation pages (PaceExplain.tsx, SkillMathExplain.tsx). A source backs the method it is
// cited for, not the values we chose. Citations stay in English in every language, so they are not translation rows.
export const STUDIES = {
  kwa: { cite: "Kwa, T., West, B., Becker, J., et al. (2025).", title: "Measuring AI Ability to Complete Long Software Tasks.", where: "arXiv:2503.14499.", url: "https://arxiv.org/abs/2503.14499" },
  metr: { cite: "METR.", title: "Task-Completion Time Horizons of Frontier AI Models.", where: "Live results page.", url: "https://metr.org/time-horizons/" },
  epoch: { cite: "Epoch AI.", title: "METR Time Horizons.", where: "Benchmarking Hub, sourced from METR.", url: "https://epoch.ai/data/metr-time-horizons" },
  nguyen: { cite: "Nguyen, D. T., & Fithian, W. (2026).", title: "On the estimation and validity of AI time horizons: a statistical look at the METR plot.", where: "arXiv:2610.12466.", url: "https://arxiv.org/abs/2610.12466" },
  hyndman: { cite: "Hyndman, R. J., & Athanasopoulos, G. (2021).", title: "Forecasting: Principles and Practice, 3rd edition.", where: "OTexts, sections 5.2 and 5.5.", url: "https://otexts.com/fpp3/simple-methods.html" },
  metrDomains: { cite: "Kwa, T., & Cheng, V. (2025).", title: "How Does Time Horizon Vary Across Domains?", where: "METR blog.", url: "https://metr.org/blog/2025-07-14-how-does-time-horizon-vary-across-domains" },
  stone: { cite: "Stone, M. (1961).", title: "The Opinion Pool.", where: "The Annals of Mathematical Statistics, 32(4), 1339-1342.", url: "https://doi.org/10.1214/aoms/1177704873" },
  bates: { cite: "Bates, J. M., & Granger, C. W. J. (1969).", title: "The Combination of Forecasts.", where: "Journal of the Operational Research Society, 20(4), 451-468.", url: "https://doi.org/10.1057/jors.1969.103" },
  hoeting: { cite: "Hoeting, J. A., Madigan, D., Raftery, A. E., & Volinsky, C. T. (1999).", title: "Bayesian model averaging: a tutorial.", where: "Statistical Science, 14(4), 382-417.", url: "https://doi.org/10.1214/ss/1009212519" },
  good: { cite: "Good, I. J. (1952).", title: "Rational Decisions.", where: "Journal of the Royal Statistical Society: Series B, 14(1), 107-114.", url: "https://doi.org/10.1111/j.2517-6161.1952.tb00104.x" },
  gneiting: { cite: "Gneiting, T., & Raftery, A. E. (2007).", title: "Strictly Proper Scoring Rules, Prediction, and Estimation.", where: "Journal of the American Statistical Association, 102(477), 359-378.", url: "https://doi.org/10.1198/016214506000001437" },
  raftery: { cite: "Raftery, A. E., Kárný, M., & Ettler, P. (2010).", title: "Online Prediction Under Model Uncertainty via Dynamic Model Averaging: Application to a Cold Rolling Mill.", where: "Technometrics, 52(1), 52-66.", url: "https://doi.org/10.1198/TECH.2009.08104" },
  cesa: { cite: "Cesa-Bianchi, N., & Lugosi, G. (2006).", title: "Prediction, Learning, and Games.", where: "Cambridge University Press.", url: "https://doi.org/10.1017/CBO9780511546921" },
  herbster: { cite: "Herbster, M., & Warmuth, M. K. (1998).", title: "Tracking the Best Expert.", where: "Machine Learning, 32(2), 151-178.", url: "https://doi.org/10.1023/A:1007424614876" },
  wolfers: { cite: "Wolfers, J., & Zitzewitz, E. (2004).", title: "Prediction Markets.", where: "Journal of Economic Perspectives, 18(2), 107-126.", url: "https://doi.org/10.1257/0895330041371321" },
  bass: { cite: "Bass, F. M. (1969).", title: "A New Product Growth for Model Consumer Durables.", where: "Management Science, 15(5), 215-227.", url: "https://doi.org/10.1287/mnsc.15.5.215" },
  griliches: { cite: "Griliches, Z. (1957).", title: "Hybrid Corn: An Exploration in the Economics of Technological Change.", where: "Econometrica, 25(4), 501-522.", url: "https://doi.org/10.2307/1905380" },
  bick: { cite: "Bick, A., Blandin, A., & Deming, D. J. (2024).", title: "The Rapid Adoption of Generative AI.", where: "NBER Working Paper 32966.", url: "https://www.nber.org/papers/w32966" },
  gmyrek: { cite: "Gmyrek, P., Berg, J., Kamiński, K., et al. (2025).", title: "Generative AI and Jobs: A Refined Global Index of Occupational Exposure.", where: "ILO Working Paper 140.", url: "https://doi.org/10.54394/HETP0387" },
  handa: { cite: "Handa, K., Tamkin, A., McCain, M., et al. (2025).", title: "Which Economic Tasks are Performed with AI? Evidence from Millions of Claude Conversations.", where: "arXiv:2503.04761.", url: "https://arxiv.org/abs/2503.04761" },
  primitives: { cite: "Anthropic Economics team (2026).", title: "Anthropic Economic Index: New building blocks for understanding AI use.", where: "Anthropic, 15 January 2026.", url: "https://www.anthropic.com/research/economic-index-primitives" },
  aei: { cite: "Massenkoff, M., Lyubich, E., Sacher, S., et al. (2026).", title: "Anthropic Economic Index report: Cadences.", where: "Anthropic, data release of 26 June 2026.", url: "https://www.anthropic.com/research/economic-index-june-2026-report" },
  observed: { cite: "Massenkoff, M., & McCrory, P. (2026).", title: "Labor market impacts of AI: A new measure and early evidence.", where: "Anthropic, 5 March 2026.", url: "https://www.anthropic.com/research/labor-market-impacts" },
} as const;
export type StudyId = keyof typeof STUDIES;
