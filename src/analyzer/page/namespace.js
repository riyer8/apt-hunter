var AptWatchAnalyzer = globalThis.AptWatchAnalyzer || {};
AptWatchAnalyzer.extractors = AptWatchAnalyzer.extractors || {};

AptWatchAnalyzer.register = function register(name, run) {
  AptWatchAnalyzer.extractors[name] = run;
};

globalThis.AptWatchAnalyzer = AptWatchAnalyzer;
