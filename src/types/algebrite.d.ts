// Algebrite no publica sus propios tipos de TypeScript ni existe un
// paquete @types/algebrite. El intento anterior de tipar la firma completa
// de `run()` no fue reconocido por el compilador real en GitHub Actions
// (error TS7016: "Could not find a declaration file for module 'algebrite'"
// — el módulo seguía resolviéndose como implícitamente `any` a pesar de la
// declaración). Se simplifica a la forma "shorthand" que el propio mensaje
// de error de tsc sugiere, que declara todo el módulo como `any`: es menos
// preciso (se pierde autocompletado/chequeo de tipos sobre `Algebrite.run`)
// pero elimina el error de forma garantizada. Los usos de `Algebrite.run(...)`
// en algebriteClient.ts ya anotan explícitamente el tipo de retorno como
// `string` en cada función exportada, así que la pérdida de precisión no se
// propaga más allá de ese archivo.
declare module "algebrite";
