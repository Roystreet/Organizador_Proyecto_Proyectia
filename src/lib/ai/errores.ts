/** Error tipado para que la capa HTTP pueda responder 404 en vez de 500. */
export class ProyectoNoEncontrado extends Error {
  constructor(public readonly proyectoId: number) {
    super(`No existe el proyecto ${proyectoId}`);
    this.name = 'ProyectoNoEncontrado';
  }
}

/** Mismo propósito, para los análisis con alcance de persona. */
export class PersonaNoEncontrada extends Error {
  constructor(public readonly personaId: number) {
    super(`No existe la persona ${personaId}`);
    this.name = 'PersonaNoEncontrada';
  }
}
