CREATE UNIQUE INDEX uq_repositories_source_path_ci
    ON repositories (lower(source_path));

CREATE UNIQUE INDEX uq_code_chunks_file_chunk_index
    ON code_chunks (file_id, chunk_index);
