/** Error tipado para que la capa HTTP pueda responder 404 en vez de 500. */
export class ProyectoNoEncontrado extends Error {
  constructor(public readonly proyectoId: number) {
    super(`No existe el proyecto ${proyectoId}`);
    this.name = 'ProyectoNoEncontrado';
  }
}
