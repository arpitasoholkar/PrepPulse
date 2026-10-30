import { EXPLANATION_STYLES } from '../constants.js';

export function getLadderStep({ step, preferredStyle, topic }) {
  // Step 0: preferred style or theory
  if (step === 0) {
    if (preferredStyle) {
      return {
        style: preferredStyle,
        styleReason: `Started with ${preferredStyle} because it worked for you on ${topic} earlier`
      };
    }
    return {
      style: 'theory',
      styleReason: 'Starting with standard conceptual explanation'
    };
  }

  // Step 1: simple
  if (step === 1) {
    return {
      style: 'simple',
      styleReason: 'Switched to simplified plain English breakdown'
    };
  }

  // Step 2: visual or analogy
  if (step === 2) {
    return {
      style: preferredStyle && preferredStyle !== 'simple' ? preferredStyle : 'visual',
      styleReason: 'Switched to visual ASCII representation and call-stack trace'
    };
  }

  // Step 3: dry_run or analogy
  return {
    style: 'dry_run',
    styleReason: 'Switched to step-by-step state dry run'
  };
}
