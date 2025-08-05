export interface Notebook {
    id: number;
    name: string;
    description: string;
    file_path: string;
    url: string;
    port: number | null;
    pid: number | null;
    status: string;
    thumbnail_image: string | null;
    thumbnail_bg: string | null;
    thumbnail_text: string | null;
    thumbnail_text_color: string | null;
  }

  