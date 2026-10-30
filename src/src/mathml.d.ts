// MathML elements render natively in browsers; React's JSX types don't list them yet.
import "react";
type MathProps = React.HTMLAttributes<HTMLElement> & { display?: "block" | "inline" };
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      math: MathProps; mrow: MathProps; mi: MathProps; mn: MathProps; mo: MathProps; mtext: MathProps; mfrac: MathProps;
    }
  }
}
