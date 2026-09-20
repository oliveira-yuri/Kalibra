// Um arquivo por tabela; este barril é o que o `drizzle-kit` lê para gerar as
// migrations. Exportar uma tabela aqui NÃO significa que código de aplicação pode
// usá-la — ver `prepared/`, cujas tabelas existem no schema e não têm chamador.
export * from './enums';
export * from './app-user';
