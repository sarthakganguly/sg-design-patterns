import { ScalarField } from './ScalarField';
import { VectorField } from './VectorField';

export class FieldManager {
  private scalarFields: Map<string, ScalarField> = new Map();
  private vectorFields: Map<string, VectorField> = new Map();

  public createScalarField(id: string, width: number, height: number): ScalarField {
    if (this.scalarFields.has(id)) return this.scalarFields.get(id)!;
    const field = new ScalarField(width, height);
    this.scalarFields.set(id, field);
    return field;
  }

  public createVectorField(id: string, width: number, height: number): VectorField {
    if (this.vectorFields.has(id)) return this.vectorFields.get(id)!;
    const field = new VectorField(width, height);
    this.vectorFields.set(id, field);
    return field;
  }

  public getScalarField(id: string): ScalarField | undefined {
    return this.scalarFields.get(id);
  }

  public getVectorField(id: string): VectorField | undefined {
    return this.vectorFields.get(id);
  }

  public clear(): void {
    this.scalarFields.forEach(f => f.release());
    this.vectorFields.forEach(f => f.release());
    this.scalarFields.clear();
    this.vectorFields.clear();
  }
}