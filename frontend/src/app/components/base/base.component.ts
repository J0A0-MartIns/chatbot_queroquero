import {Component, HostListener, OnInit} from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { BaseService } from '../../services/base.service';
import { Documento } from '../../models/documento.model';
import { TemaService } from '../../services/tema.service';
import { SubtemaService } from '../../services/subtema.service';
import { Tema } from '../../models/tema.model';
import { Subtema } from '../../models/subtema.model';
import { AuthService } from '../../auth/auth.service';
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";

@Component({
  selector: 'app-base',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './base.component.html',
  styleUrls: ['./base.component.css']
})
export class BaseComponent implements OnInit {
  documentos: Documento[] = [];
  termoBusca: string = '';
  temas: Tema[] = [];
  subtemasDoTemaSelecionado: Subtema[] = [];
  showModal: boolean = false;
  isEditMode: boolean = false;
  activeMenuIndex: number | null = null;
  docEmEdicao: Documento;
  idTemaSelecionadoNoModal: number | null = null;
  novoTemaNome: string = '';
  novoSubtemaNome: string = '';
  openActionIndex: number | null = null;
  dropdownPosition = { top: '0px', left: '0px' };
  arquivoParaUpload: File | null = null;

  constructor(
      private baseService: BaseService,
      private temaService: TemaService,
      private subtemaService: SubtemaService,
      private authService: AuthService
  ) {
    this.docEmEdicao = this.criarDocVazio();
  }

  ngOnInit(): void {
    this.carregarDocumentos();
    this.carregarTemas();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.icon-button') || target.closest('.global-dropdown')) {
      return;
    }
    this.openActionIndex = null;
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.arquivoParaUpload = file;
    }
  }

  carregarDocumentos(): void {
    this.baseService.getDocumentos().subscribe(data => this.documentos = data);
  }

  carregarTemas(): void {
    this.temaService.getTemas().subscribe(data => this.temas = data);
  }

  docsFiltrados(): Documento[] {
    if (!this.termoBusca.trim()) return this.documentos;
    return this.documentos.filter(doc =>
        doc.titulo.toLowerCase().includes(this.termoBusca.toLowerCase())
    );
  }

  abrirModalParaCriar(): void {
    this.isEditMode = false;
    this.docEmEdicao = this.criarDocVazio();
    this.idTemaSelecionadoNoModal = null;
    this.novoTemaNome = '';
    this.novoSubtemaNome = '';
    this.subtemasDoTemaSelecionado = [];
    this.showModal = true;
  }

  abrirModalParaEditar(doc: Documento): void {
    this.openActionIndex = null;
    this.isEditMode = true;
    this.docEmEdicao = JSON.parse(JSON.stringify(doc));
    this.novoTemaNome = '';
    this.novoSubtemaNome = '';
    if (doc.Subtema) {
      this.idTemaSelecionadoNoModal = doc.Subtema.id_tema;
      this.onTemaChangeNoModal();
    }
    this.showModal = true;
  }

  async excluirArquivoAnexado(id_arquivo: number): Promise<void> {
    if (confirm('Tem a certeza que deseja excluir este anexo?')) {
      try {
        await lastValueFrom(this.baseService.excluirArquivo(id_arquivo));
        if (this.docEmEdicao.DocumentoArquivos) {
          this.docEmEdicao.DocumentoArquivos = this.docEmEdicao.DocumentoArquivos.filter(
              f => f.id_arquivo !== id_arquivo
          );
        }
        this.carregarDocumentos();
      } catch (error) {
        console.error('Erro ao excluir arquivo:', error);
        alert('Não foi possível excluir o anexo.');
      }
    }
  }

  fecharModal(): void {
    this.showModal = false;
  }

  toggleActionSelect(index: number, event: MouseEvent): void {
    if (this.openActionIndex === index) {
      this.openActionIndex = null;
      return;
    }

    const button = event.target as HTMLElement;
    const rect = button.getBoundingClientRect();

    this.dropdownPosition = {
      top: `${rect.bottom + window.scrollY}px`,
      left: `${rect.left + window.scrollX - 100}px`
    };

    this.openActionIndex = index;
  }

  async salvarDocumento(): Promise<void> {
    try {
      let temaIdFinal: number;
      if (this.novoTemaNome.trim()) {
        const novoTema = await lastValueFrom(this.temaService.criarTema(this.novoTemaNome.trim()));
        temaIdFinal = novoTema.id_tema;
      } else if (this.idTemaSelecionadoNoModal) {
        temaIdFinal = this.idTemaSelecionadoNoModal;
      } else {
        alert('Por favor, selecione ou crie um tema.');
        return;
      }

      let subtemaIdFinal: number;
      if (this.novoSubtemaNome.trim()) {
        if (!temaIdFinal) {
          alert('Um erro ocorreu ao determinar o tema. Tente novamente.');
          return;
        }
        const novoSubtema = await lastValueFrom(this.subtemaService.criarSubtema(this.novoSubtemaNome.trim(), temaIdFinal));
        subtemaIdFinal = novoSubtema.id_subtema;
      } else if (this.docEmEdicao.id_subtema && this.docEmEdicao.id_subtema > 0) {
        subtemaIdFinal = this.docEmEdicao.id_subtema;
      } else {
        alert('Por favor, selecione ou crie um subtema.');
        return;
      }

      this.docEmEdicao.id_subtema = subtemaIdFinal;

      if (this.isEditMode && this.docEmEdicao.id_documento) {
        const documentoAtualizado = await lastValueFrom(this.baseService.atualizarDocumento(this.docEmEdicao.id_documento, this.docEmEdicao));
        if (this.arquivoParaUpload) {
          await lastValueFrom(this.baseService.uploadArquivo(documentoAtualizado.id_documento!, this.arquivoParaUpload));
        }
      } else {
        const novoDocumento = await lastValueFrom(this.baseService.criarDocumento(this.docEmEdicao));
        if (this.arquivoParaUpload && novoDocumento.id_documento) {
          await lastValueFrom(this.baseService.uploadArquivo(novoDocumento.id_documento, this.arquivoParaUpload));
        }
      }

      this.carregarDocumentos();
      this.carregarTemas();
      this.fecharModal();

    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      alert('Ocorreu um erro ao salvar o documento.');
    }
  }

  onTemaChangeNoModal(): void {
    this.subtemasDoTemaSelecionado = [];
    if (this.docEmEdicao) {
      this.docEmEdicao.id_subtema = 0;
    }
    if (this.idTemaSelecionadoNoModal) {
      this.subtemaService.getSubtemasPorTema(this.idTemaSelecionadoNoModal)
          .subscribe(data => this.subtemasDoTemaSelecionado = data);
    }
  }

  excluirDocumento(id: number | undefined): void {
    this.openActionIndex = null;
    if (!id) return;
    if (confirm('Tem certeza de que deseja excluir este documento?')) {
      this.baseService.excluirDocumento(id).subscribe(() => this.carregarDocumentos());
    }
  }

  private criarDocVazio(): Documento {
    const user = this.authService.getUser();
    return {
      titulo: '',
      conteudo: '',
      palavras_chave: '',
      ativo: true,
      id_usuario: user?.id_usuario,
      id_subtema: 0,
      DocumentoArquivos: []
    };
  }
  mudarAtivo(doc: Documento): void {
    if (doc.id_documento === undefined) return;

    const novoStatus = !doc.ativo;
    doc.ativo = novoStatus;

    this.baseService.atualizarAtivo(doc.id_documento, novoStatus).subscribe({
      error: (err) => {
        console.error('Erro ao atualizar o status do documento:', err);
        doc.ativo = !novoStatus;
        alert('Não foi possível atualizar o status do documento.');
      }
    });
  }

}
