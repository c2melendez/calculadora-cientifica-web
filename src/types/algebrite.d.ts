// Algebrite no publica sus propios tipos de TypeScript ni existe un
// paquete @types/algebrite. Sin esta declaración, todo lo que sale de
// `Algebrite.run(...)` se vuelve `any` y se propaga silenciosamente por
// `algebriteClient.ts`, lo cual con "strict": true (tsconfig.app.json)
// puede producir errores de "implicit any" río abajo en cuanto se instale
// el paquete real — ya se detectó uno así en una pasada de revisión.
//
// Esta es una firma MÍNIMA basada en el uso real que hace este proyecto
// (una sola función `run`). Si en un módulo futuro se necesita otra
// función de Algebrite (ej. acceso a su API interna de simplificación),
// hay que ampliar esta declaración.
declare module "algebrite" {
  interface Algebrite {
    run(input: string): string;
  }
  const Algebrite: Algebrite;
  export default Algebrite;
}
